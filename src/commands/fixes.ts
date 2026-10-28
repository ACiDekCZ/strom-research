// strom fixes — what a fix of strom's left behind in this research (commands/fixchecks.ts): each check, what it found
// here (free: the research's own data, no agent, no network), what setting it right does and does not, and what it
// would take. The decision is the person's alone and is kept with the research (strom.json): set right, left as it is,
// or later (nothing kept: asked again). Setting it right that costs (readings again) starts only at a person's own
// terminal — never an agent, never a run nobody watches, never --yes; a few first (the most promising), then the rest,
// always whole readings (all the images of one, never a part of it).
// Another model or agent reading now (new-model) is offered the same way: what earlier readings left open, read again.

import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { resolveCommand } from "../cli/execute.ts";
import { lines } from "../cli/format.ts";
import { ui, type UIKey } from "../cli/ui.ts";
import { UsageError } from "../core/errors.ts";
import { isArchive } from "../core/mode.ts";
import { refuseInArchive } from "../core/state.ts";
import { create } from "../core/records.ts";
import { phrase } from "../core/phrases.ts";
import type { Media, Task } from "../core/model.ts";
import type { Tree } from "../core/tree.ts";
import {
  compareDocuments,
  compareReadings,
  checksHere,
  decide,
  decisionChange,
  decisionKeyOf,
  foundCount,
  estimateFix,
  fixCheck,
  fixEnv,
  fixStates,
  FIX_CHECKS,
  loadDocResult,
  byReading,
  defaultStage,
  readBefore,
  stagesOf,
  type Compared,
  type Comparison,
  type FixCheck,
  type FixEstimate,
  type FixItem,
  type FixState,
  type Reason,
} from "./fixchecks.ts";
import type { ReadResult } from "../core/document.ts";
import { VERSION } from "../core/tree.ts";
import { applyNameRewrites, nameRewritesDone, undoNameRewrites, type NameNote, type NameRewrite } from "../core/participants.ts";
import { calibrationLabel } from "../core/viewsizes.ts";
import { calibrationKey, loadAliases, resolveKey, splitKey, UNKNOWN_KEY } from "../core/modelkey.ts";
import { agentsHere } from "../core/apps.ts";
import { Settings } from "../core/config.ts";
import { RUNNERS } from "../runners/index.ts";
import { loadReadings, type Block } from "./readings.ts";
import { pool } from "./read.ts";
import { BATCH } from "../core/reader.ts";
import { readerAgent } from "./readers.ts";
import { which } from "../core/which.ts";

/** Readings read first, to try it on. */
export const FIX_TRY = 3;
/** Readings shown as examples. */
const EXAMPLES = 5;
export const FIX_ORIGIN = "fix:";

type T = (key: UIKey, values?: Record<string, string | number>) => string;

/**
 * The places read together as their earlier reading read them: the images of one reading with the same question, part
 * and blindness are one strom read again (its batches as strom read makes them); a document alone.
 */
function readsOf(items: FixItem[]): FixItem[][] {
  const out = new Map<string, FixItem[]>();
  for (const i of items) {
    const key = i.document ? `doc|${i.key}` : [i.reading, i.question, i.crop ?? "", i.blind ? "blind" : "", i.context ?? ""].join("|");
    out.set(key, [...(out.get(key) ?? []), i]);
  }
  return [...out.values()];
}

/** The readers the places take: a document read by two takes two; a reading of more images than a batch, more. */
const readersOf = (items: FixItem[]) => readsOf(items).reduce((n, g) => n + (g[0]!.document ? (g[0]!.readers ?? 1) : Math.ceil(g.length / BATCH)), 0);

/** An agent and model that reads the places again. */
interface Reader {
  agent: string;
  model: string | undefined;
}

/** The reader of strom read here now: the agent asked (--agent, else the research's), its model for handwriting. */
function readerNow(ctx: Context, tree: Tree, model?: string): Reader {
  const agent = readerAgent(ctx, tree);
  return { agent, model: model ?? ctx.settings.models(agent, tree.config).vision };
}

/** The agent and model as one key: the model an alias runs on, where this research saw it run. */
const readerKey = (tree: Tree, r: Reader) => resolveKey(calibrationKey(r.agent, r.model), loadAliases(tree.root));

/** `perReading`: after a trial, the real time each of its readers took, readers at once and all. */
function estimateOf(ctx: Context, tree: Tree, calls: number, o: { reader?: Reader; perReading?: number } = {}): FixEstimate {
  const { agent, model } = o.reader ?? readerNow(ctx, tree);
  return estimateFix(tree.root, { agent, model, calls, parallel: ctx.settings.readParallel(tree.config), ...(o.perReading !== undefined ? { perReading: o.perReading } : {}) });
}

const estimateText = (t: T, e: FixEstimate, agent: string, trial = false) =>
  t("ui.fixes.estimate", {
    level: t(`ui.fixes.level.${e.level}` as UIKey),
    calls: e.calls,
    minutes: e.minutes,
    basis: trial ? t("ui.fixes.basis.trial") : e.basis === "earlier" ? t("ui.fixes.basis.earlier", { n: e.earlier, agent }) : t("ui.fixes.basis.count"),
  });

/** " — cheap, about 3 min": what a choice would take, beside it. */
const costText = (t: T, e: FixEstimate) => t("ui.fixes.cost", { level: t(`ui.fixes.level.${e.level}` as UIKey), minutes: e.minutes });

const stateText = (t: T, s: FixState) =>
  s.state === "pending"
    ? s.check.unit === "reading"
      ? t("ui.fixes.state.pending.readings", { count: s.found.readings })
      : s.check.unit === "participant"
        ? t("ui.fixes.state.pending.participants", { count: foundCount(s.found) })
        : t("ui.fixes.state.pending", { count: s.found.items.length })
    : s.state === "nothing"
      ? t("ui.fixes.state.nothing")
      : t(`ui.fixes.state.${s.state}` as UIKey, { date: s.decision!.at.slice(0, 10) });

/** "Claude Code · claude-opus-5-5" — "model unknown" where nothing says. */
const modelText = (t: T, key: string) => (key === UNKNOWN_KEY ? t("ui.fixes.model.unknown") : calibrationLabel(key, t("ui.settings.model.own")));

const REASONS: Reason[] = ["unclear", "differ", "conflict", "unconfirmed"];

/** "3 readings (7 places)": the readings of these places and the places, always both. */
const partText = (t: T, items: FixItem[]) => t("ui.fixes.part", { readings: new Set(items.map((i) => i.reading)).size, count: items.length });

/** The images of one reading: "M0001 (B0001:1), M0002 (B0001:2) … (3)". */
function imagesText(g: FixItem[]): string {
  const named = (i: FixItem) => `${i.media}${i.ref ? ` (${i.ref})` : ""}`;
  return g[0]!.document ? g[0]!.document.files.join(", ") : g.length > 2 ? `${named(g[0]!)}, ${named(g[1]!)} … (${g.length})` : g.map(named).join(", ");
}

/** One earlier reading, all its places: its images, why it is worth reading again, its sources. */
function exampleText(t: T, g: FixItem[]): string {
  const i = g[0]!;
  const unclear = g.reduce((n, x) => n + x.unclear, 0);
  const src = [...new Set(g.flatMap((x) => x.sources))].sort();
  const sources = src.length ? ` · ${src.slice(0, 3).join(", ")}` : "";
  if (i.before !== undefined)
    return t("ui.fixes.new-model.example", {
      reading: i.reading,
      media: imagesText(g),
      before: modelText(t, i.before),
      reasons: [
        ...REASONS.filter((r) => g.some((x) => x.reasons?.includes(r))).map((r) => (r === "unclear" ? t("ui.fixes.unclear", { n: unclear }) : t(`ui.fixes.reason.${r}` as UIKey))),
        ...(g.some((x) => x.direct) ? [t("ui.fixes.reason.direct")] : []),
      ].join(", "),
      sources,
    });
  return t("ui.fixes.example", {
    reading: i.reading,
    media: imagesText(g),
    from: i.from ?? "",
    gain: String(i.gain ?? ""),
    sources,
    unclear: unclear ? ` · ${t("ui.fixes.unclear", { n: unclear })}` : "",
    estimated: g.some((x) => x.estimated) ? ` · ${t("ui.fixes.estimated")}` : "",
  });
}

/** What a check's texts say beside its counts: the version that fixed it; of new-model the models before and now. */
function textValues(t: T, s: FixState): Record<string, string | number> {
  const m = s.found.models;
  if (!m) return { since: s.check.since };
  return {
    since: s.check.since,
    now: modelText(t, m.now),
    before: m.before.map((b) => `${modelText(t, b.key)} (${t("ui.fixes.readings", { n: b.readings })})`).join(", "),
    newer: m.newer ? t("ui.fixes.new-model.newer") : "",
  };
}

/**
 * Many found, not all of them useful: what the narrower stages alone would take — the disputed readings, then with the
 * direct line (byReading puts them first).
 */
function stagesText(ctx: Context, tree: Tree, t: T, groups: FixItem[][]): string[] {
  if (groups.length <= FIX_TRY) return [];
  const st = stagesOf(groups);
  const line = (key: UIKey, n: number) => {
    const these = groups.slice(0, n).flat();
    const e = estimateOf(ctx, tree, readersOf(these));
    return t(key, { part: partText(t, these), level: t(`ui.fixes.level.${e.level}` as UIKey), calls: e.calls, minutes: e.minutes });
  };
  return [
    ...(st.disputed && st.disputed < st.all ? [line("ui.fixes.estimate.disputed", st.disputed)] : []),
    ...(st.direct > st.disputed && st.direct < st.all ? [line("ui.fixes.estimate.direct", st.direct)] : []),
  ];
}

/** What it found, in readings and their places: of new-model why each reading is worth reading again, how many of each. */
function foundText(t: T, s: FixState): string {
  const f = s.found;
  if (!f.items.length && !f.unjudged) return t("ui.fixes.found.none");
  const part = partText(t, f.items);
  if (f.models) {
    const groups = byReading(f.items);
    const n = (has: (i: FixItem) => boolean) => groups.filter((g) => g.some(has)).length;
    const why = REASONS.filter((r) => n((i) => !!i.reasons?.includes(r))).map((r) => t(`ui.fixes.found.${r}` as UIKey, { n: n((i) => !!i.reasons?.includes(r)) }));
    const direct = n((i) => !!i.direct);
    const documents = groups.filter((g) => g[0]!.document).length;
    return t("ui.fixes.found.readings", { part, documents: documents ? t("ui.fixes.found.documents", { n: documents }) : "", why: [...why, ...(direct ? [t("ui.fixes.found.direct", { n: direct })] : [])].join(", ") });
  }
  return t(!f.estimated ? "ui.fixes.found.exact" : !f.exact ? "ui.fixes.found.estimated" : "ui.fixes.found", { part, exact: f.exact, estimated: f.estimated }) + (f.unjudged ? t("ui.fixes.unjudged", { n: f.unjudged }) : "");
}

/** A participant as it is said: its name, its note after it in parentheses. */
const nameSaid = (n: NameNote) => `${n.name}${n.note ? ` (${n.note})` : ""}`;

/** One name set apart: its fact, its role, before → after. */
const rewriteText = (t: T, r: NameRewrite) =>
  t("ui.fixes.participant-names.example", {
    event: r.event,
    role: t(`ui.show.role.${r.role}` as UIKey),
    before: nameSaid(r.before),
    name: r.after.name,
    note: r.after.note ? t("ui.fixes.participant-names.note", { note: r.after.note }) : "",
  });

/** A check that rewrites by rules: what it is, what it found, examples, what setting it right does and does not. */
function rewriteDetail(t: T, s: FixState): string[] {
  const f = s.found;
  const rewrites = f.rewrites ?? [];
  const id = s.check.id;
  return [
    `${id} · ${t(`ui.fixes.${id}.name` as UIKey)} — ${stateText(t, s)}`,
    t(`ui.fixes.${id}.what` as UIKey, { since: s.check.since }),
    rewrites.length || f.unsplit ? t(`ui.fixes.${id}.found` as UIKey, { found: rewrites.length + (f.unsplit ?? 0), split: rewrites.length, unsplit: f.unsplit ?? 0 }) : t("ui.fixes.found.none"),
    ...rewrites.slice(0, EXAMPLES).map((r) => rewriteText(t, r)),
    rewrites.length > EXAMPLES ? t(`ui.fixes.${id}.more` as UIKey, { n: rewrites.length - EXAMPLES, id }) : undefined,
    rewrites.length ? t(`ui.fixes.${id}.does` as UIKey, { id }) : undefined,
    rewrites.length ? t(`ui.fixes.${id}.not` as UIKey, { id }) : undefined,
  ].filter((l): l is string => l !== undefined);
}

/** What it is, what it found, what setting it right does and does not, and what it would take. */
function detail(ctx: Context, tree: Tree, t: T, s: FixState): string[] {
  if (s.check.remedy === "rewrite") return rewriteDetail(t, s);
  const f = s.found;
  const agent = readerAgent(ctx, tree);
  const values = textValues(t, s);
  const groups = byReading(f.items);
  return [
    `${s.check.id} · ${t(`ui.fixes.${s.check.id}.name` as UIKey)} — ${stateText(t, s)}`,
    // new-model with nothing read with another model: nothing to say what changed
    !f.models && s.check.id === "new-model" ? t(`ui.fixes.${s.check.id}.idle` as UIKey) : t(`ui.fixes.${s.check.id}.what` as UIKey, values),
    foundText(t, s),
    ...groups.slice(0, EXAMPLES).map((g) => exampleText(t, g)),
    groups.length > EXAMPLES ? t("ui.fixes.more", { n: groups.length - EXAMPLES, id: s.check.id }) : undefined,
    f.estimated ? t("ui.fixes.estimated.why") : undefined,
    f.items.length ? t(`ui.fixes.${s.check.id}.does` as UIKey, values) : undefined,
    f.items.length ? t(`ui.fixes.${s.check.id}.not` as UIKey, values) : undefined,
    f.items.length ? estimateText(t, estimateOf(ctx, tree, readersOf(f.items)), agent) : undefined,
    ...stagesText(ctx, tree, t, groups),
  ].filter((l): l is string => l !== undefined);
}

function stateData(ctx: Context, tree: Tree, s: FixState, all = false) {
  if (s.check.remedy === "rewrite") {
    const rewrites = s.found.rewrites ?? [];
    return {
      id: s.check.id,
      since: s.check.since,
      paid: s.check.paid,
      remedy: s.check.remedy,
      state: s.state,
      ...(s.decision ? { decision: s.decision } : {}),
      found: { count: rewrites.length + (s.found.unsplit ?? 0), split: rewrites.length, unsplit: s.found.unsplit ?? 0 },
      items: all ? rewrites : rewrites.slice(0, EXAMPLES),
    };
  }
  const items = all ? s.found.items : s.found.items.slice(0, EXAMPLES);
  return {
    id: s.check.id,
    ...(s.key !== s.check.id ? { key: s.key } : {}),
    since: s.check.since,
    paid: s.check.paid,
    state: s.state,
    ...(s.decision ? { decision: s.decision } : {}),
    found: { count: s.found.items.length, readings: s.found.readings, exact: s.found.exact, estimated: s.found.estimated, unjudged: s.found.unjudged },
    ...(s.found.models ? { models: s.found.models } : {}),
    ...(s.found.items.length ? { estimate: estimateOf(ctx, tree, readersOf(s.found.items)), stages: stagesOf(byReading(s.found.items)) } : {}),
    items,
  };
}

function stateOfCheck(ctx: Context, tree: Tree, id: string): FixState {
  const check = fixCheck(id);
  if (!check) throw new UsageError(`no check "${id}"`, { hint: `strom fixes (the checks: ${FIX_CHECKS.map((c) => c.id).join(", ")})` });
  const env = fixEnv(ctx, tree);
  // a check this research has not (one that reads, in an archive): looked at alone, what waits not kept
  if (!checksHere(tree).includes(check)) return fixStates(tree, env, { checks: [check], keep: false })[0]!;
  return fixStates(tree, env, { keep: !ctx.backupFailed }).find((s) => s.check.id === id)!;
}

/**
 * Set a check that rewrites right at the person's terminal (participant-names): what it is and found, then the choice —
 * set them apart, leave them as they are, or later (Enter). One operation and one commit, free, also in an archive.
 */
async function runRewrite(ctx: Context, tree: Tree, t: T, s: FixState): Promise<{ decided?: "declined" | "fixed"; changed: number; records: number }> {
  const id = s.check.id;
  const out = (l = "") => ctx.io.stdout(l + "\n");
  for (const l of detail(ctx, tree, t, s)) out(l);
  const rewrites = s.found.rewrites ?? [];
  if (!rewrites.length) return { changed: 0, records: 0 };
  const choices = [{ label: t(`ui.fixes.${id}.all` as UIKey, { n: rewrites.length }) }, { label: t("ui.fixes.decline") }];
  const pick = await ctx.choose(t(`ui.fixes.${id}.ask` as UIKey), choices, choices.length, { back: t("ui.fixes.later") });
  if (pick === undefined) {
    out(t("ui.fixes.later.said", { id }));
    return { changed: 0, records: 0 };
  }
  if (pick === 1) {
    tree.withTreeLock(() => {
      decide(tree, s.key, "declined");
      tree.commit(`Fix ${s.key}: left as it is`);
    });
    out(t("ui.fixes.declined", { id }));
    return { decided: "declined", changed: 0, records: 0 };
  }
  const r = tree.withTreeLock(() => {
    // the names and the decision: one operation, one commit
    const done = applyNameRewrites(tree, rewrites, VERSION, decisionChange(s.key, "fixed"));
    if (done.changed) tree.commit(`Fix ${s.key}: ${done.changed} participant names set apart from their notes in ${done.records} records`);
    return done;
  });
  out(t(`ui.fixes.${id}.done` as UIKey, { n: r.changed, records: r.records, id }));
  return { decided: "fixed", changed: r.changed, records: r.records };
}

/** The person's own decision: in their terminal alone (an agent, a run nobody watches: exit 4, with the command). */
function personOnly(ctx: Context, t: T, question: string, set: string, says: "ui.fixes.person" | "ui.fixes.person.decide" = "ui.fixes.person"): void {
  ctx.requireHuman(question, set, "fixes", t(says, { command: set }), { window: false });
}

/** The earlier reader's blocks of the image read. */
function blocksOf(tree: Tree, stem: string, media: Media): Block[] {
  const r = loadReadings(tree).find((x) => x.stem === stem);
  return (r?.blocks ?? []).filter((b) => b.media === media.id || (b.recordset === media.recordset && b.num !== undefined && b.num === media.image));
}

interface Reread {
  item: FixItem;
  result: Compared;
  /** The facts each reading read that the other does not (differ, refined). */
  differs?: Pick<Comparison, "before" | "now">;
  reading?: string;
  secs: number;
  task?: string;
  /** Why nothing was read, where strom read said. */
  error?: string;
}

/** A comparison as a reading again keeps it: its result, and what differs where something does. */
function compared(c: Comparison | undefined): Pick<Reread, "result" | "differs"> {
  if (!c) return { result: "failed" };
  return { result: c.result, ...(c.before.length || c.now.length ? { differs: { before: c.before, now: c.now } } : {}) };
}

/** Each place read again, blind with the earlier question, from the sharper copy; the readings held against each other. */
async function readAgain(ctx: Context, tree: Tree, t: T, items: FixItem[], model?: string): Promise<Reread[]> {
  const { def } = resolveCommand(["read"]);
  const { def: doc } = resolveCommand(["document", "read"]);
  const byId = new Map(tree.list<Media>("media").map((m) => [m.id, m]));
  // the readers' own lines are the agent's: the person sees one line per place
  const quiet = Object.create(ctx) as Context;
  Object.defineProperty(quiet, "io", { value: { ...ctx.io, stdout: () => {}, stderr: () => {} } });
  let k = 0;
  const reads = readsOf(items);
  const why = (e: unknown) => (e instanceof Error ? e.message : String(e));
  return (await pool(reads, ctx.settings.readParallel(tree.config), async (group): Promise<Reread[]> => {
    const item = group[0]!;
    ctx.io.stdout(t("ui.fixes.reading", { k: ++k, n: reads.length, media: item.document ? item.reading : imagesText(group) }) + "\n");
    const began = Date.now();
    if (item.document) {
      // a document: a new reading of the same pages and parts beside the earlier one (never strom document again)
      const d = item.document;
      const opts = { readers: String(d.readers), ...(model ? { model } : {}), ...(d.regions.length ? { region: d.regions } : {}), ...(d.note ? { note: d.note } : {}), ...(d.persons?.length ? { person: d.persons } : {}) };
      let now: ReadResult | undefined;
      let error: string | undefined;
      try {
        now = (await doc.run(quiet, { args: d.files, opts })).data as ReadResult | undefined;
      } catch (e) {
        error = why(e);
      }
      const before = loadDocResult(tree.root, item.reading);
      const secs = (Date.now() - began) / 1000;
      const c = before ? compareDocuments(before, now) : undefined;
      return [{ item, ...compared(c), ...(now?.id ? { reading: now.id } : {}), secs, ...(error ? { error } : {}) }];
    }
    const opts: Record<string, string | boolean> = { question: item.question, ...(model ? { model } : {}), ...(item.crop ? { crop: item.crop } : {}), parallel: "1", ...(item.blind ? { blind: true } : {}), ...(item.context ? { context: item.context } : {}) };
    let reading: string | undefined;
    let error: string | undefined;
    try {
      const r = await def.run(quiet, { args: group.map((i) => i.media), opts });
      reading = (r.data as { reading?: string } | undefined)?.reading;
    } catch (e) {
      error = why(e);
    }
    // the time of the reading, shared by its images
    const secs = (Date.now() - began) / 1000 / group.length;
    return group.map((i) => {
      const m = byId.get(i.media);
      const now = reading && m ? blocksOf(tree, reading, m) : [];
      const before = m ? blocksOf(tree, i.reading, m) : [];
      return { item: i, ...compared(compareReadings(before, now, tree.lang)), ...(reading ? { reading } : {}), secs, ...(error ? { error } : {}) };
    });
  })).flat();
}

/** A task to hold the two readings against each other where they differ or the new one reads more; nothing overwritten. */
function tasksFor(tree: Tree, check: FixCheck, done: Reread[], now?: string): void {
  const lang = tree.lang;
  const p = check.phrases ?? "fix.reread";
  const label = (k: string) => (k === UNKNOWN_KEY ? phrase(lang, "fix.model.unknown") : calibrationLabel(k, phrase(lang, "fix.model.own")));
  for (const d of done) {
    if ((d.result !== "differ" && d.result !== "refined") || !d.reading) continue;
    const i = d.item;
    const task = create<Task>(
      tree,
      "task",
      {
        level: "verify",
        priority: d.result === "differ" ? 2 : 3,
        what: phrase(lang, `${p}.what`, { media: i.document ? i.document.files.join(", ") : i.media, old: i.reading, now: d.reading }),
        where: [...(i.document ? i.document.files : [i.media]), ...i.sources],
        why: [phrase(lang, `${p}.why.${d.result}`, { since: check.since, from: i.from ?? "", before: i.before ? label(i.before) : "", now: now ? label(now) : "" }), differsText(lang, d)].filter(Boolean).join(" "),
        doneWhen: phrase(lang, `${p}.done`, { old: i.reading, now: d.reading, sources: i.sources.join(", ") || i.media, show: i.document ? "strom document show" : "strom readings" }),
        subject: [...i.sources],
        state: "open",
        origin: `${FIX_ORIGIN}${check.id}`,
      } as never,
      (id) => `+${id} task "compare the readings ${i.reading} and ${d.reading} of ${i.document ? i.document.files.join(", ") : i.media}"`,
    );
    d.task = task.id;
  }
}

/** One sentence of what differs (the facts each read that the other does not), or what the new reading read beside. */
function differsText(lang: string, d: Reread): string {
  const list = (ws: string[]) => (ws.length ? ws.slice(0, 6).join(", ") + (ws.length > 6 ? ", …" : "") : "—");
  if (!d.differs) return "";
  if (d.result === "differ") return phrase(lang, "fix.differs", { before: list(d.differs.before), now: list(d.differs.now) });
  return d.differs.now.length ? phrase(lang, "fix.more", { now: list(d.differs.now) }) : "";
}

/** `secs`: the real time the readings took, readers at once and all. Its places: the same, refined, different. */
function summaryText(t: T, done: Reread[], secs: number): string[] {
  const n = (r: Compared) => done.filter((d) => d.result === r).length;
  const wall = Math.max(1, Math.ceil(secs / 60));
  const tasks = done.filter((d) => d.task).map((d) => d.task!);
  const error = done.find((d) => d.result === "failed" && d.error)?.error;
  return [
    t("ui.fixes.result", { part: partText(t, done.map((d) => d.item)), same: n("same"), refined: n("refined"), differ: n("differ"), minutes: wall }) + (n("failed") ? t("ui.fixes.result.failed", { n: n("failed") }) : ""),
    // why nothing was read, as strom read said it (the first one)
    error ? t("ui.fixes.result.why", { why: error }) : undefined,
    tasks.length ? t("ui.fixes.tasks", { tasks: tasks.join(", ") }) : undefined,
  ].filter((l): l is string => l !== undefined);
}

/** Why an agent cannot read here now (strom read would refuse it), else undefined. */
function notReady(ctx: Context, agent: string): string | undefined {
  const runner = RUNNERS[agent];
  if (!runner) return `strom reads with no agent "${agent}"`;
  if (agent === "script") return ctx.env.STROM_RUNNER_SCRIPT ? undefined : "STROM_RUNNER_SCRIPT names no script";
  return which(runner.command, ctx.env) ? undefined : `${runner.command} is not installed here`;
}

/** The agents that can read here now, in strom's order. */
const readyHere = (ctx: Context) => Object.keys(RUNNERS).filter((a) => !notReady(ctx, a));

/** The agent asked (--agent, else the research's) cannot read here: said at once with those that can, nothing read. */
function requireReady(ctx: Context, tree: Tree, command: string): void {
  const agent = readerAgent(ctx, tree);
  const why = notReady(ctx, agent);
  if (!why) return;
  const ready = readyHere(ctx);
  throw new UsageError(`${agent} cannot read here: ${why}`, {
    hint: ready.length ? `ready to read here: ${ready.join(", ")} — ${command} --agent ${ready[0]}` : "no agent can read here — strom doctor says what is missing",
  });
}

/**
 * Who reads the places again: the agent asked (--agent) or the model given (--model) as said; else, where more agents
 * can read here, the person's choice — the one reading now first, each said with whether it read these before; where
 * the one now read them, another one here is recommended. Undefined: later.
 */
async function chooseReader(ctx: Context, tree: Tree, t: T, s: FixState, model: string | undefined): Promise<Reader | undefined> {
  const now = readerNow(ctx, tree, model);
  if (model || ctx.settings.agent(tree.config).source === "flag") return now;
  // only the agents that can read here (the one now too)
  const others = agentsHere(ctx.env)
    .filter((a) => a.cli && a.id !== now.agent && !notReady(ctx, a.id))
    .map((a) => ({ agent: a.id, model: ctx.settings.models(a.id, tree.config).vision }));
  const readers = [...(notReady(ctx, now.agent) ? [] : [now]), ...others];
  if (!others.length || !readers.length) {
    requireReady(ctx, tree, `strom fixes run ${s.check.id}`);
    return now;
  }
  const before = new Set([...readBefore(tree, s.found.items)].map((k) => splitKey(k).agent));
  const readBy = (r: Reader) => before.has(r.agent);
  const pick = readBy(now) ? Math.max(0, readers.findIndex((r) => !readBy(r))) : 0;
  const choices = readers.map((r, i) => ({
    label: [
      calibrationLabel(readerKey(tree, r), t("ui.settings.model.own")),
      costText(t, estimateOf(ctx, tree, readersOf(s.found.items), { reader: r })),
      readBy(r) ? t("ui.fixes.reader.before") : "",
      i === pick && pick > 0 ? t("ui.fixes.reader.other") : "",
    ].join(""),
  }));
  const i = await ctx.choose(t("ui.fixes.reader.ask"), choices, pick, { back: t("ui.fixes.later") });
  return i === undefined ? undefined : readers[i];
}

/** The context the readers read in: the agent chosen, as if asked with --agent. */
function readerContext(ctx: Context, r: Reader): Context {
  if (r.agent === ctx.settings.agent().value && ctx.settings.agent().source === "flag") return ctx;
  const c = Object.create(ctx) as Context;
  Object.defineProperty(c, "settings", { value: new Settings(ctx.env, { ...ctx.settings.flags, agent: r.agent }, ctx.settings.config) });
  return c;
}

/**
 * Set one check right at the person's terminal: who reads, a few first, the disputed alone, with the direct line, or all,
 * then the rest — or left as it is, or later. Always whole readings, the most useful first (byReading).
 */
async function runCheck(ctx: Context, tree: Tree, t: T, s: FixState, opts: { first?: number; try: number; model?: string }): Promise<{ done: Reread[]; decided?: "declined" | "fixed" }> {
  const id = s.check.id;
  const out = (l = "") => ctx.io.stdout(l + "\n");
  let left = byReading(s.found.items).slice(0, opts.first ?? Infinity);
  const done: Reread[] = [];
  for (const l of detail(ctx, tree, t, s)) out(l);
  const reader = await chooseReader(ctx, tree, t, s, opts.model);
  if (!reader) {
    out(t("ui.fixes.later.said", { id }));
    return { done };
  }
  const rctx = readerContext(ctx, reader);
  const key = readerKey(tree, reader);
  // the real time the readings so far took (readers at once and all): the rest estimated by it
  const spent = { readings: 0, secs: 0 };
  let first = true;
  while (left.length) {
    const perReading = spent.readings ? spent.secs / spent.readings : undefined;
    const est = (groups: FixItem[][]) => estimateOf(ctx, tree, readersOf(groups.flat()), { reader, ...(perReading !== undefined ? { perReading } : {}) });
    const offer = (key: UIKey, n: number) => ({ label: t(key, { part: partText(t, left.slice(0, n).flat()) }) + costText(t, est(left.slice(0, n))), n });
    // a trial from the narrowest stage that holds any; then the disputed alone, with the direct line, all — each
    // offered where it is more than the one before and less than all
    const st = stagesOf(left);
    const few = Math.min(opts.try, defaultStage(left));
    const choices = [
      ...(left.length > few ? [offer(first ? "ui.fixes.try" : "ui.fixes.try.more", few)] : []),
      ...(st.disputed > few && st.disputed < left.length ? [offer("ui.fixes.disputed", st.disputed)] : []),
      ...(st.direct > Math.max(few, st.disputed) && st.direct < left.length ? [offer("ui.fixes.direct", st.direct)] : []),
      offer(first ? "ui.fixes.all" : "ui.fixes.rest", left.length),
      { label: t("ui.fixes.decline"), n: 0 },
    ];
    if (!first) out(estimateText(t, est(left), reader.agent, perReading !== undefined));
    // Enter: later — paid work starts on a choice of its own
    const pick = await ctx.choose(t(first ? "ui.fixes.ask" : "ui.fixes.ask.rest"), choices, choices.length, { back: t(first ? "ui.fixes.later" : "ui.fixes.end") });
    if (pick === undefined) {
      out(t("ui.fixes.later.said", { id }));
      return { done };
    }
    if (pick === choices.length - 1) {
      tree.withTreeLock(() => {
        decide(tree, s.key, "declined");
        tree.commit(`Fix ${s.key}: left as it is${done.length ? ` after ${done.length} read again` : ""}`);
      });
      out(t("ui.fixes.declined", { id }));
      return { done, decided: "declined" };
    }
    const these = left.slice(0, choices[pick]!.n);
    left = left.slice(these.length);
    const began = Date.now();
    const read = await readAgain(rctx, tree, t, these.flat(), opts.model);
    const secs = (Date.now() - began) / 1000;
    spent.readings += readersOf(these.flat());
    spent.secs += secs;
    tree.withTreeLock(() => {
      tasksFor(tree, s.check, read, key);
      const fixed = !left.length && read.every((d) => d.result !== "failed");
      if (fixed) decide(tree, s.key, "fixed");
      const n = (r: Compared) => read.filter((d) => d.result === r).length;
      tree.commit(`Fix ${s.key}: ${read.length} read again with ${key} (same ${n("same")}, refined ${n("refined")}, differ ${n("differ")}${n("failed") ? `, not read ${n("failed")}` : ""})${fixed ? "; set right" : ""}`);
    });
    done.push(...read);
    out(lines(...summaryText(t, read, secs)));
    first = false;
  }
  const failed = new Set(done.filter((d) => d.result === "failed").map((d) => d.item.reading)).size;
  out(failed ? t("ui.fixes.failed.left", { n: failed, id }) : t("ui.fixes.done"));
  return { done, ...(failed ? {} : { decided: "fixed" as const }) };
}

function positive(v: unknown, name: string, fallback?: number): number | undefined {
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new UsageError(`--${name} is a whole number from 1`, { hint: `strom fixes run <check> --${name} 5` });
  return n;
}

const SET_RIGHT_HELP =
  "Setting a check right that costs (readings again) only a person starts, at their own terminal — neither an agent nor\n" +
  "a run nobody watches (STROM_NONINTERACTIVE), and never --yes: an agent tells the person the command. It shows what\n" +
  `it is first, then offers to try it on the ${FIX_TRY} most promising readings, says how they came out (same, refined,\n` +
  "different, the real time) and offers the rest with the estimate made again from their times — or to end there.\n" +
  "Always whole readings (all the images of one, a document whole), never a part of one; counts are readings, with their\n" +
  "places beside them, the estimate in reader calls (strom read's readers it starts). An agent that cannot read here\n" +
  "(--agent unknown, its CLI not installed) is refused at once, with those that can.";

register(
  {
    path: ["fixes"],
    summary: "What a fix of strom's left behind in this research: each check, what it found, its estimate (free)",
    group: "history",
    tree: true,
    description:
      "A fix of strom's holds from then on; what was done before it stays as it was. Each check finds, in the research's\n" +
      "own data (free: no agent, no network), what a fix left behind here — the places, readings and sources, why — and\n" +
      "says what setting it right does and does not do and what it would take: cheap, medium or expensive, the number of\n" +
      "readings and about how long (by the earlier readers here). Nothing is ever overwritten: a reading again stands\n" +
      "beside the earlier one, a difference becomes a task. The person decides: set it right (strom fixes run), leave it as\n" +
      "it is (strom fixes decline) or later (nothing kept). The decision is kept with the research (strom.json \"fixes\")\n" +
      "and holds on every computer. strom doctor and the menu say when one waits. In an archive only participant-names.\n" +
      "The checks: blind-reduced — a reading of a part of an image (strom read --crop) read from the whole image, reduced,\n" +
      "where a sharper copy of the part was at hand (strom before 1.19.0); where this computer has no record of the\n" +
      "reading's views, the place is estimated from the sources' entries on the image, and said so.\n" +
      "new-model — the agent or model reading now is another than the one that read earlier: the earlier readings (strom\n" +
      "read and documents) where something stayed open — places not read ([?], illegible), blind readers who differed, an\n" +
      "open conflict or a reading never confirmed at the source; one whose model nobody knows only with places not read.\n" +
      "Which model reads better is never guessed from its name: it says what read before and what reads now, and that a\n" +
      "model is newer only of the same line. Asked once for each agent and model (\"fixes\" keyed new-model:<agent model>):\n" +
      "another model reading later asks again. The model a reading ran on: its report's head, else this computer's records\n" +
      "of its readers (.strom/metrics/readers.jsonl), else unknown. The most useful first, by stage: disputed (blind readers\n" +
      "who differed, an open conflict, a reading not confirmed at the source), then the direct line, then the rest (places\n" +
      "not read); dates and witnesses only order within a stage.\n" +
      "participant-names — a participant's name that carries what the record says of them (status, occupation, village,\n" +
      "house number, a number, the entry): set apart by rules (no agent, no network, free, also in an archive) into the name\n" +
      "and the note, a note there kept and the rest added to it; a name that cannot be set apart for sure is left and\n" +
      "counted; nobody is linked to a person. One operation, one commit; strom fixes undo participant-names puts it back.\n" +
      SET_RIGHT_HELP,
    examples: ["strom fixes", "strom fixes show blind-reduced", "strom fixes show new-model", "strom fixes show participant-names", "strom fixes --json"],
    run: (ctx: Context) => {
      const tree = ctx.tree();
      const t: T = (key, values = {}) => ui(tree.lang, key, values);
      // an archive: nobody reads there, nothing of an agent said — only what is rewritten by rules
      const archive = isArchive(tree);
      const states = fixStates(tree, fixEnv(ctx, tree), { keep: !ctx.backupFailed });
      const pending = states.filter((s) => s.state === "pending");
      const text = lines(
        t(archive ? "ui.fixes.title.archive" : "ui.fixes.title"),
        ...states.map((s) => `  ${s.check.id} · ${t(`ui.fixes.${s.check.id}.name` as UIKey)} — ${stateText(t, s)}`),
        pending.length ? "" : undefined,
        pending.length ? t("ui.fixes.next", { id: pending[0]!.check.id }) : undefined,
      );
      return { text, data: { checks: states.map((s) => stateData(ctx, tree, s)) } };
    },
  },
  {
    path: ["fixes", "show"],
    summary: "One check of strom's fixes whole: what it is, what it found here, what setting it right does, the estimate (free)",
    group: "history",
    tree: true,
    args: [{ name: "check", description: "the check, e.g. blind-reduced", required: true }],
    examples: ["strom fixes show blind-reduced", "strom fixes show new-model --json"],
    run: (ctx: Context, { args }) => {
      const tree = ctx.tree();
      const t: T = (key, values = {}) => ui(tree.lang, key, values);
      const check = fixCheck(args[0]!);
      if (isArchive(tree) && check?.remedy !== "rewrite") return { text: t("ui.fixes.none"), data: { checks: [] } };
      // the estimate is of the agent asked: one that cannot read here said at once
      if (check?.remedy !== "rewrite" && ctx.settings.agent(tree.config).source === "flag") requireReady(ctx, tree, `strom fixes show ${args[0]}`);
      const s = stateOfCheck(ctx, tree, args[0]!);
      const text = lines(...detail(ctx, tree, t, s), "", s.state === "pending" ? t("ui.fixes.decide", { id: s.check.id }) : s.state === "declined" ? t("ui.fixes.reopen.how", { id: s.check.id }) : undefined);
      return { text, data: stateData(ctx, tree, s, true) };
    },
  },
  {
    path: ["fixes", "run"],
    summary: "Set a check of strom's fixes right — a person at their own terminal only (paid: readings again)",
    group: "history",
    tree: true,
    description:
      "What it is, what it found and the estimate first; then the choice: try it on a few first, all of them, leave it as\n" +
      "it is, or later (Enter: later). Each place is read again as the earlier reading asked (its question, blind as it\n" +
      "was) from the sharper copy; the new reading stands beside the earlier one, and where they differ or the new one reads\n" +
      "more, a task to hold them against each other is added (strom task list). Nothing is overwritten. new-model reads\n" +
      "with the agent and model reading now: a strom read again with its question and part, a document as a new reading of\n" +
      "the same pages and parts (strom document read, its own D…), the earlier one kept. Without a check: each that waits\n" +
      "in turn. The most useful first, by stage: disputed (readers who differed, a conflict, not confirmed at the source),\n" +
      "then the direct line, then the rest; a trial is taken from the narrowest stage that holds any, and the disputed alone\n" +
      "and with the direct line are offered beside all, each with what it would take.\n" +
      "Who reads: --agent and --model; else, where more agents can read here, the person chooses — each said with whether\n" +
      "it read these before, another one recommended where the one now did. After the first few, the rest is estimated\n" +
      "again by the real time they took.\n" +
      "participant-names reads nothing: the names set apart as shown (strom fixes show participant-names), all or none,\n" +
      "in one operation and one commit, free, also in an archive; strom fixes undo participant-names puts them back.\n" +
      SET_RIGHT_HELP,
    args: [{ name: "check", description: "the check (default: each that waits)" }],
    options: [
      { name: "first", type: "string", value: "<n>", description: "only the n most promising readings (each whole)" },
      { name: "try", type: "string", value: "<n>", description: `readings read first, to try it on (default ${FIX_TRY})` },
      { name: "model", type: "string", value: "<model>", description: "the readers' model (default: the agent's model.vision); with --agent: another agent reads" },
    ],
    examples: ["strom fixes run blind-reduced", "strom fixes run new-model --first 10", "strom fixes run blind-reduced --agent codex", "strom fixes run participant-names"],
    run: async (ctx: Context, { args, opts }) => {
      const tree = ctx.tree();
      const t: T = (key, values = {}) => ui(tree.lang, key, values);
      const asked = args[0] ? fixCheck(args[0]) : undefined;
      // an archive: what is rewritten by rules only (nobody reads there)
      if (asked?.remedy !== "rewrite") refuseInArchive(tree, "strom fixes run", ctx.settings.agent(tree.config).value);
      const set = `strom fixes run${args[0] ? ` ${args[0]}` : ""}`;
      if (ctx.yes) throw new UsageError("--yes never sets a fix right: a person chooses at their terminal", { hint: set });
      // who reads, before anything is offered: the agent asked, or with nothing asked, any here
      if (typeof opts.model === "string" && !opts.model.trim()) throw new UsageError("--model names a model", { hint: `${set} --model <model>` });
      const first = positive(opts.first, "first");
      const tryN = positive(opts.try, "try", FIX_TRY)!;
      const all = args[0] ? [stateOfCheck(ctx, tree, args[0])] : fixStates(tree, fixEnv(ctx, tree), { keep: !ctx.backupFailed }).filter((s) => s.state === "pending");
      // first what is rewritten by rules: free, nobody reads (participant-names)
      const rewrites = all.filter((s) => s.check.remedy === "rewrite");
      const states = all.filter((s) => s.check.remedy !== "rewrite");
      const results: { id: string; decided?: string; read?: number; tasks?: string[]; changed?: number; records?: number }[] = [];
      if (rewrites.some((s) => foundCount(s.found))) {
        personOnly(ctx, t, "Set the names of participants apart from their notes?", set, "ui.fixes.person.decide");
        for (const s of rewrites) {
          const r = await runRewrite(ctx, tree, t, s);
          results.push({ id: s.check.id, ...(r.decided ? { decided: r.decided } : {}), changed: r.changed, records: r.records });
        }
      }
      // nothing to read again: said so, before who reads or whose choice it is
      if (!states.some((s) => s.found.items.length)) {
        if (results.length) return { text: "", data: { checks: results } };
        if (rewrites.length) {
          // a check that rewrites with nothing found: what it is, all the same
          ctx.io.stdout(lines(...rewrites.flatMap((s) => detail(ctx, tree, t, s))) + "\n");
          return { text: "", data: { checks: rewrites.map((s) => ({ id: s.check.id, changed: 0, records: 0 })) } };
        }
        return { text: t("ui.fixes.none"), data: { checks: states.map((s) => ({ id: s.check.id, read: 0, tasks: [] })) } };
      }
      if (ctx.settings.agent(tree.config).source === "flag" || typeof opts.model === "string" || !readyHere(ctx).length) requireReady(ctx, tree, set);
      personOnly(ctx, t, "Read places of this research again (paid readings)?", set);
      for (const s of states) {
        if (!s.found.items.length) {
          ctx.io.stdout(lines(...detail(ctx, tree, t, s)) + "\n");
          results.push({ id: s.check.id, read: 0, tasks: [] });
          continue;
        }
        const r = await runCheck(ctx, tree, t, s, { ...(first ? { first } : {}), try: tryN, ...(typeof opts.model === "string" ? { model: opts.model } : {}) });
        results.push({ id: s.check.id, ...(r.decided ? { decided: r.decided } : {}), read: r.done.length, tasks: r.done.filter((d) => d.task).map((d) => d.task!) });
      }
      return { text: "", data: { checks: results } };
    },
  },
  {
    path: ["fixes", "decline"],
    summary: "Leave a check of strom's fixes as it is: not offered again (the person's own decision)",
    group: "history",
    tree: true,
    args: [{ name: "check", description: "the check, e.g. blind-reduced", required: true }],
    examples: ["strom fixes decline blind-reduced"],
    run: (ctx: Context, { args }) => {
      const tree = ctx.tree();
      const t: T = (key, values = {}) => ui(tree.lang, key, values);
      const s = stateOfCheck(ctx, tree, args[0]!);
      personOnly(ctx, t, `Leave ${s.check.id} as it is?`, `strom fixes decline ${s.check.id}`, "ui.fixes.person.decide");
      tree.withTreeLock(() => {
        decide(tree, s.key, "declined");
        tree.commit(`Fix ${s.key}: left as it is`);
      });
      return { text: t("ui.fixes.declined", { id: s.check.id }), data: { id: s.check.id, decision: "declined" } };
    },
  },
  {
    path: ["fixes", "reopen"],
    summary: "Ask a check of strom's fixes again: its decision taken back (the person's own)",
    group: "history",
    tree: true,
    args: [{ name: "check", description: "the check, e.g. blind-reduced", required: true }],
    examples: ["strom fixes reopen blind-reduced"],
    run: (ctx: Context, { args }) => {
      const tree = ctx.tree();
      const t: T = (key, values = {}) => ui(tree.lang, key, values);
      const s = stateOfCheck(ctx, tree, args[0]!);
      personOnly(ctx, t, `Ask ${s.check.id} again?`, `strom fixes reopen ${s.check.id}`, "ui.fixes.person.decide");
      if (s.decision)
        tree.withTreeLock(() => {
          decide(tree, s.key, undefined);
          tree.commit(`Fix ${s.key}: asked again`);
        });
      return { text: t("ui.fixes.reopened", { id: s.check.id }), data: { id: s.check.id, decision: null } };
    },
  },
  {
    path: ["fixes", "undo"],
    summary: "Put back what a check that rewrites set right (participant-names): the names and notes as they were (the person's own)",
    group: "history",
    tree: true,
    person: "Putting a fix back is the person's own decision, at their own terminal: never done by an agent",
    description:
      "Each name and note the fix set apart is put back as it was, where it is still as the fix left it; one changed since\n" +
      "is left as it is and counted. One step of the history (one operation, one commit); the fix is then left as it is\n" +
      "(strom fixes reopen asks again). Also in an archive.",
    args: [{ name: "check", description: "the check, e.g. participant-names", required: true }],
    examples: ["strom fixes undo participant-names"],
    run: (ctx: Context, { args }) => {
      const tree = ctx.tree();
      const t: T = (key, values = {}) => ui(tree.lang, key, values);
      const check = fixCheck(args[0]!);
      if (!check) throw new UsageError(`no check "${args[0]}"`, { hint: `strom fixes (the checks: ${FIX_CHECKS.map((c) => c.id).join(", ")})` });
      if (check.remedy !== "rewrite")
        throw new UsageError(`${check.id} reads again and overwrites nothing: there is nothing to put back`, { hint: `strom fixes show ${check.id}` });
      const set = `strom fixes undo ${check.id}`;
      if (!nameRewritesDone(tree).length) return { text: t(`ui.fixes.${check.id}.nothing` as UIKey), data: { id: check.id, restored: 0, left: 0 } };
      if (ctx.yes) throw new UsageError("--yes never puts a fix back: a person chooses at their terminal", { hint: set });
      personOnly(ctx, t, "Put the names of participants back as they were?", set, "ui.fixes.person.decide");
      const key = decisionKeyOf(tree, check, fixEnv(ctx, tree));
      const r = tree.withTreeLock(() => {
        const done = undoNameRewrites(tree, decisionChange(key, "declined"));
        tree.commit(`Fix ${key}: undone, ${done.restored} participant names put back as they were${done.left ? `, ${done.left} changed since left` : ""}`);
        return done;
      });
      return {
        text: t(`ui.fixes.${check.id}.undone` as UIKey, { n: r.restored, left: r.left ? t(`ui.fixes.${check.id}.left` as UIKey, { n: r.left }) : "" }),
        data: { id: check.id, restored: r.restored, records: r.records, left: r.left, decision: "declined" },
      };
    },
  },
);
