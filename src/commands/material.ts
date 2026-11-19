// strom material sort|show|cancel: files of the family's material sorted by readers of the research (core/sort.ts) —
// for each file a title, a date, a kind and links to the tree proposed, nothing written. The Strom app asks it through
// its bridge (POST /material/sort), which queues it and starts it; the person takes of the proposal what they agree with.
// More files than one sort takes the app asks as a run (run-…): parts of a sort each, its bridge alone queues and starts
// them; strom material show|cancel <run-…> says it and stops it.

import fs from "node:fs";
import path from "node:path";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { counted, lines } from "../cli/format.ts";
import { ui } from "../cli/ui.ts";
import { StromError, UsageError } from "../core/errors.ts";
import type { Input } from "../core/model.ts";
import type { Tree } from "../core/tree.ts";
import { refuseInArchive } from "../core/state.ts";
import { materialFile } from "../core/material.ts";
import { readableFile } from "../core/readable.ts";
import { makeView } from "../core/views.ts";
import { batches, BATCH, READER_MINUTES_HELP } from "../core/reader.ts";
import { langName } from "../core/lang.ts";
import { alive } from "../core/document.ts";
import {
  APP_SORT_FROM,
  appSort,
  cancelSort,
  checkSortAsk,
  counted as countedRead,
  isTextFile,
  keptProposals,
  loadSort,
  parseSortReport,
  queueSort,
  refuseUnsigned,
  RUN_ID,
  runForApp,
  runParts,
  saveSort,
  shownSort,
  SORT_FINAL,
  SORT_ID,
  SORT_MOST_FILES,
  SORT_NEXT,
  SORT_PDF_PAGES,
  SORT_TEXT_FILE_MAX,
  SORT_TEXT_MAX,
  sortCancelPath,
  sortContext,
  sortCost,
  sortPrompt,
  sortWorkDir,
  listSorts,
  startable,
  textOfFile,
  unproposedOf,
  unstartableAppSort,
  unstartableSaid,
  type RawProposal,
  type SortFileView,
  type SortState,
} from "../core/sort.ts";
import { noteLive } from "../core/live.ts";
import { readers } from "./readers.ts";

const CANCEL_LOOK_MS = 500;
const now = () => new Date().toISOString();

function sortOf(tree: Tree, id: string): SortState {
  const s = SORT_ID.test(id) ? loadSort(tree.root, id) : undefined;
  if (!s) throw new UsageError(`no sort ${id.slice(0, 40)}`, { code: "material.sort", hint: "strom material show (the sorts kept here)" });
  return s;
}

/**
 * A file as its readers are given it: its pictures (a PDF's first pages); a text (.txt, .md) as a copy of its text in
 * the sort's folder (`work`) — its beginning, of a long one (textOfFile); else why it is judged by its name alone.
 */
function fileView(ctx: Context, tree: Tree, shared: string, i: Input, max: number, min: number, work: string): SortFileView {
  const file = materialFile(tree, shared, i);
  if (!file || !fs.existsSync(file)) return { input: i, views: [], not: "its file is not on this computer" };
  if (isTextFile(i.name ?? path.basename(file), i.mime)) {
    try {
      const t = textOfFile(file);
      const copy = path.join(work, "texts", `${i.id}.txt`);
      fs.mkdirSync(path.dirname(copy), { recursive: true });
      fs.writeFileSync(copy, t.cut ? `${t.text}\n\n[strom: only the first ${t.chars} characters of this file are given here]\n` : t.text);
      return { input: i, views: [], text: { file: copy, chars: t.chars, ...(t.cut ? { cut: t.cut } : {}) } };
    } catch (e) {
      return { input: i, views: [], not: `its text not read here (${(e as Error).message.slice(0, 80)})` };
    }
  }
  try {
    const pages = readableFile(tree.root, file, { env: ctx.env }).pages;
    const views = Array.from({ length: Math.min(pages, SORT_PDF_PAGES) }, (_, k) => ({
      page: k + 1,
      view: makeView(tree, file, i.id, { max, min, ...(k ? { page: k + 1 } : {}) }, { kind: "whole", reader: true, capFrom: "default" }).file,
    }));
    return { input: i, views, ...(pages > 1 ? { pages } : {}) };
  } catch (e) {
    // a file no reader opens (a video, a TIFF), a HEIC or PDF this computer cannot convert: judged by its name
    const code = e instanceof StromError ? e.code : undefined;
    return { input: i, views: [], not: code === "read.type" ? "no picture" : `not converted here${code ? ` (${code})` : ""}` };
  }
}

/** A sort's readers at work: each a few files, its report read by strom; nothing written to the research. */
async function sortNow(ctx: Context, tree: Tree, s: SortState, opts: Record<string, unknown>): Promise<SortState> {
  const fail = (reason: string, error: string): SortState => {
    const out: SortState = { ...s, state: "failed", since: now(), reason, error };
    delete out.pid;
    saveSort(tree.root, out);
    return out;
  };
  const shared = ctx.settings.shared()?.value;
  if (!shared) return fail("start", "no shared folder is set (strom setup)");
  let team;
  try {
    team = readers(ctx, tree, shared, "material sort", "1", opts, sortWorkDir(tree.root, s.id), { stem: s.id });
  } catch (e) {
    return fail("start", (e as Error).message);
  }
  const inputs = s.files.map((id) => tree.get<Input>(id)).filter((i): i is Input => !!i && i.type === "input" && !i.retracted);
  s = { ...s, state: "working", since: now(), pid: process.pid, agent: team.agent, ...(team.model ? { model: team.model } : {}), filesDone: 0 };
  saveSort(tree.root, s);
  const stop = new AbortController();
  const look = setInterval(() => {
    if (fs.existsSync(sortCancelPath(tree.root, s.id))) stop.abort();
  }, CANCEL_LOOK_MS);
  look.unref?.();
  const raw: RawProposal[] = [];
  const stray: RawProposal[] = [];
  try {
    const files = inputs.map((i) => fileView(ctx, tree, shared, i, team.viewMax, team.viewMin, sortWorkDir(tree.root, s.id)));
    const context = sortContext(tree, inputs, s.text);
    const groups = batches(files, BATCH, (f) => Math.max(1, f.views.length));
    const langSaid = langName(s.lang, "en") || s.lang;
    let next = 1;
    const runOne = async (group: SortFileView[]) => {
      if (stop.signal.aborted) return;
      const n = next++;
      s = { ...s, readers: [...(s.readers ?? []), { n, files: group.map((f) => f.input.id), began: now() }] };
      saveSort(tree.root, s);
      const head = `# Sort ${s.id} · reader ${n}\n\nFiles: ${group.map((f) => f.input.id).join(", ")}\n\n${SORT_NEXT}\n`;
      // what it may open: the pictures, and the copy of each text file (read as text)
      const views = group.flatMap((f) => [...f.views.map((v) => v.view), ...(f.text ? [f.text.file] : [])]);
      const r = await team.read(String(n), views, `Sort ${s.id}`, (report) => sortPrompt(tree, { files: group, text: s.text, lang: s.lang, langName: langSaid, report, context }), { head, signal: stop.signal });
      // a block of a file another reader was given: only where that reader wrote none (keptProposals: the first stands)
      for (const p of parseSortReport(r.text)) (group.some((f) => f.input.id === p.id) ? raw : stray).push(p);
      // its files done, whatever it said of them: the app shows how far the sort is (filesDone)
      s = { ...s, filesDone: (s.filesDone ?? 0) + group.length, readers: (s.readers ?? []).map((x) => (x.n === n ? { ...x, ended: now(), outcome: r.outcome, ...(r.costUsd !== undefined ? { usd: r.costUsd } : {}), ...(r.costPartial || r.costUsd === undefined ? { partial: true as const } : {}) } : x)) };
      saveSort(tree.root, s);
    };
    const queue = [...groups];
    await Promise.all(
      Array.from({ length: Math.min(queue.length, team.parallel) }, async () => {
        for (let g = queue.shift(); g; g = queue.shift()) await runOne(g);
      }),
    );
  } catch (e) {
    clearInterval(look);
    return fail("error", (e as Error).message);
  } finally {
    clearInterval(look);
  }
  const cancelled = stop.signal.aborted || fs.existsSync(sortCancelPath(tree.root, s.id));
  fs.rmSync(sortCancelPath(tree.root, s.id), { force: true });
  const ran = s.readers ?? [];
  const kept = keptProposals(tree, s.files, [...raw, ...stray], ran);
  const failedWhy = ran.find((r) => r.outcome && r.outcome !== "ok")?.outcome;
  if (cancelled) s = { ...s, state: "cancelled", since: now() };
  else if (ran.some((r) => r.outcome === "ok") || (ran.length > 0 && kept.proposals.length > 0)) {
    // a file with no proposal says why (never one without a word)
    const unproposed = unproposedOf(s.files, [...raw, ...stray], kept, ran);
    s = { ...s, state: "done", since: now(), proposals: kept.proposals, ...(kept.dropped.length ? { dropped: kept.dropped } : {}), ...(unproposed.length ? { unproposed } : {}) };
  }
  else s = { ...s, state: "failed", since: now(), reason: failedWhy ?? "error", error: team.failed.join("; ") || "no reader ended" };
  delete s.pid;
  saveSort(tree.root, s);
  return s;
}

/** A part of a run said: "part 2 of 3 of run-…" (nothing of a sort of its own). */
const partSaid = (s: SortState) => (s.run !== undefined ? ` · part ${s.part} of ${s.parts} of ${s.run}` : "");

/** A sort said for an agent: its state, and each proposal on a few lines. */
function said(tree: Tree, s: SortState): string {
  const now = shownSort(s);
  const proposals = now.state === "done" ? keptProposals(tree, now.files, now.proposals ?? []).proposals : [];
  const head = `${now.id} · ${now.state} · ${counted(now.files.length, "file")}${partSaid(now)}${now.reason ? ` · ${now.reason}` : ""}${now.error ? ` — ${now.error}` : ""}`;
  const out = [head];
  for (const p of proposals) {
    out.push("", `${p.id} (${p.sure})${p.title ? ` · ${p.title}` : ""}${p.date ? ` · ${p.date}` : ""}${p.kind ? ` · ${p.kind}` : ""}${p.unrelated ? " · unrelated (not of the family)" : ""}`);
    for (const l of p.links ?? []) out.push(`  link ${l.type} ${l.ref}${l.event ? ` ${l.event}` : ""}`);
    if (p.why) out.push(`  why: ${p.why}`);
  }
  if (now.state === "done") for (const u of now.unproposed ?? []) if (!proposals.some((p) => p.id === u.id)) out.push("", `${u.id} · no proposal: ${u.why}${u.outcome ? ` (${u.outcome})` : ""}${u.said ? ` — ${u.said}` : ""}`);
  if (now.state === "done" && !proposals.length) out.push("", "nothing proposed");
  if (now.state === "working") out.push("", `${now.filesDone ?? 0} of ${now.files.length} files done`);
  if (now.state === "queued" && now.run !== undefined) out.push("", `the bridge of the Strom app starts it when its turn comes and the app's readings allow (read.app) — strom material cancel ${now.run} stops the whole run`);
  else if (now.state === "queued") out.push("", `next: strom material sort ${now.id} sorts it (the bridge of the Strom app starts its queue by itself) — strom material cancel ${now.id}`);
  return lines(...out);
}

/** A run of the app said for an agent: its state, its files done, each part on a line (its proposals: strom material show <sort-…>). */
function runSaid(run: ReturnType<typeof runForApp>): string {
  return lines(
    `${run.id} · ${run.state} · ${run.filesDone} of ${counted(run.files, "file")} done · ${counted(run.parts.length, "part")}`,
    ...run.parts.map((p) => `  ${p.part}. ${p.id} · ${p.state} · ${counted(p.files, "file")}${p.filesDone !== undefined ? ` (${p.filesDone} done)` : ""}`),
    "",
    run.state === "queued" || run.state === "working" ? `each part's proposals: strom material show <sort-…> — strom material cancel ${run.id} stops the run` : "each part's proposals: strom material show <sort-…>",
  );
}

/** The parts of a run of the app kept here (those its bridge signed), else refused. */
function runOf(tree: Tree, id: string): SortState[] {
  const parts = runParts(tree.root, tree.key, id);
  if (!parts.length) throw new UsageError(`no run ${id.slice(0, 40)} of the Strom app here`, { code: "material.sort", hint: "strom material show (the sorts kept here)" });
  return parts;
}

const shownData = (tree: Tree, s: SortState) => {
  const now = shownSort(s);
  return { ...now, ...(now.state === "done" ? { proposals: keptProposals(tree, now.files, now.proposals ?? []).proposals } : {}) };
};

/**
 * Paid readings the person asked for (spec 102, 17 Nov 2026: the person keeps control): in their terminal their yes
 * (Enter says no), else a window of the system; nobody to ask: exit 4 (needs-input) — an agent never says it for them.
 * A sort the app queued (its own dialog asked the person, POST /material/sort) is not asked again — only one its bridge
 * signed and only once (sort.ts startable): a record that merely says it is the app's, or one begun once and put back
 * into the queue, is never sorted (sortQueued).
 */
async function personSays(ctx: Context, tree: Tree, s: SortState | Pick<SortState, "files" | "text">, set: string): Promise<boolean> {
  // the app's only when its bridge signed it as it took it and it never began (never a record that merely says so: see sortQueued)
  if ("id" in s && startable(tree.key, s)) return true;
  const n = s.files.length;
  const says = ui(ctx.uiLang(), "ui.consent.sort", { n: String(n), readings: String(sortCost(n)) });
  return !!(await ctx.requireHumanYes(`Sort ${n} file(s) of the material by readers of the research (${sortCost(n)} paid reading(s))? Only when the user asked for it.`, set, "material.sort", says));
}
const notSorted = (ctx: Context, files: string[]) => ({ text: ui(ctx.uiLang(), "ui.consent.sort.no"), data: { sorted: false, files } });

/** A queued sort sorted now (the bridge starts it so, detached). */
async function sortQueued(ctx: Context, tree: Tree, id: string, opts: Record<string, unknown>) {
  if (opts.text !== undefined || opts.queue) throw new UsageError(`${id} is sorted as it was asked: --text and --queue are not given again`, { hint: `strom material sort ${id}` });
  let s = sortOf(tree, id);
  if (s.state !== "queued") {
    if (SORT_FINAL.includes(s.state)) fs.rmSync(sortCancelPath(tree.root, id), { force: true });
    throw new UsageError(`${id} is not queued (${shownSort(s).state})`, { code: "material.sort", hint: `strom material show ${id}` });
  }
  // said to be the Strom app's without its bridge's signature (written outside the bridge, or queued by an older strom),
  // or signed but begun once already and put back into the queue (its leave to start it spent): never sorted, nor asked
  // for — failed, said in live.log and here. Sealed on another computer: taken over first.
  const key = tree.requireKey();
  if (unstartableAppSort(key, s)) {
    const said = unstartableSaid(key, s);
    refuseUnsigned(tree.root, s, said);
    noteLive(
      tree.root,
      appSort(key, s)
        ? `${id}: the Strom app's sort begun once already, put back into the queue outside its bridge: not sorted again, failed (strom material sort) — asked again in the Strom app`
        : `${id}: said to be the Strom app's but not signed by its bridge: not sorted, failed (strom material sort) — asked again in the Strom app`,
    );
    throw new UsageError(`${id} was ${said}`, { code: "material.sort-unsigned", params: { id }, hint: "the person asks for the sort again in the Strom app" });
  }
  // a part of a run of the app not counted against its readings yet: its bridge alone starts it, when read.app allows
  if (s.run !== undefined && !countedRead(key, s)) throw new UsageError(`${id} is part ${s.part} of ${s.parts} of the Strom app's run ${s.run}: its bridge starts it when the app's readings allow (read.app)`, { code: "material.sort-waiting", params: { id, run: s.run }, hint: `strom material show ${s.run}` });
  if (s.pid && s.pid !== process.pid && alive(s.pid)) throw new UsageError(`${id} is being sorted now`, { hint: `strom material show ${id}` });
  if (!fs.existsSync(sortCancelPath(tree.root, id)) && !(await personSays(ctx, tree, s, `strom material sort ${id}`))) return notSorted(ctx, s.files);
  if (fs.existsSync(sortCancelPath(tree.root, id))) {
    fs.rmSync(sortCancelPath(tree.root, id), { force: true });
    s = { ...s, state: "cancelled", since: now() };
    saveSort(tree.root, s);
  } else s = await sortNow(ctx, tree, s, opts);
  return { text: said(tree, s), data: shownData(tree, s), exitCode: s.state === "failed" ? 1 : 0 };
}

register({
  path: ["material", "sort"],
  summary: "Have readers propose a title, date, kind and links to the tree for files of the family's material — nothing written",
  group: "inputs",
  tree: true,
  description:
    "Files of the family's material (photos, documents, letters: inputs I…) looked at by readers of the research (its\n" +
    "reader agent, model.vision): for each file a title, a date, a kind (photo, document, record, other) and links to\n" +
    "people, couples, their events and sources of the tree, each with why and how sure (high, medium, low).\n" +
    "--text: what the person knows of them (their words, followed where the files do not say otherwise).\n" +
    `At most ${SORT_MOST_FILES} files, a text of at most ${SORT_TEXT_MAX} characters; of a PDF its first ${SORT_PDF_PAGES} pages, a HEIC\n` +
    `converted, a text file (.txt, .md) read as text (its first ${SORT_TEXT_FILE_MAX} characters); a file no reader opens is\n` +
    "judged by its name, path and notes. A file with no proposal says why (unproposed); while at work filesDone says\n" +
    "how many files its readers are done with. Nothing is written to the research: the\n" +
    "proposal is kept beside it (strom material show <id>), and what the person takes of it is written as theirs\n" +
    "(strom input edit, the Strom app). Never proposed: a title, kind or date the person gave, a link they gave or took\n" +
    "off, an ID the research does not have. It waits for its readers (a few minutes): run it in the foreground.\n" +
    "--queue: only kept to be sorted, nothing sorted now; strom material sort <id> sorts it (the bridge of the Strom\n" +
    "app starts only the sorts the app asked for, POST /material/sort, signed by the bridge as it takes them; one that\n" +
    "says it is the app's without that signature is never sorted: material.sort-unsigned, asked again in the app). The\n" +
    "signature is good once: spent with the sort's first step out of the queue, so one begun and put back into the\n" +
    "queue by hand is never sorted again (failed, \"begun once already\"; asked again in the app).\n" +
    "Paid readings, only when the user asks for them: the user says yes in their own terminal (Enter says no) or in a\n" +
    "window of the system; with nobody to ask it ends with exit 4 (needs-input) — an agent never answers for the user.",
  args: [{ name: "files", description: "the files: inputs I… of the material; or a sort queued: sort-…", variadic: true }],
  options: [
    { name: "text", type: "string", value: "<text>", description: `what the person knows of the files (at most ${SORT_TEXT_MAX} characters)` },
    { name: "model", type: "string", value: "<model>", description: "the readers' model (default: model.vision)" },
    { name: "minutes", type: "string", value: "<n>", description: READER_MINUTES_HELP, mistaken: ["timeout", "time", "time-limit", "max-minutes"] },
    { name: "parallel", type: "string", value: "<n>", description: "readers at once (default 3)" },
    { name: "queue", type: "boolean", description: "keep it to be sorted later, sort nothing now (strom material sort <id> sorts it)" },
  ],
  examples: ["strom material sort I0003 I0005", 'strom material sort I0003 I0005 --text "the wedding of the grandparents, about 1930"', "strom material sort I0003 --queue"],
  run: async (ctx: Context, { args, opts }) => {
    const tree = ctx.tree();
    refuseInArchive(tree, "strom material sort");
    if (args.length === 1 && SORT_ID.test(args[0]!.trim())) return sortQueued(ctx, tree, args[0]!.trim(), opts);
    if (!args.length) throw new UsageError("which files: inputs I… of the material", { code: "material.body", hint: "strom material sort I0004 I0005" });
    const ask = checkSortAsk(tree, { ids: args, text: opts.text });
    // asked here: never a sort of the app's (only its bridge gives that, signed; its own dialog asked the person) — a
    // worker named so is no app
    const from = ctx.env.STROM_WORKER === APP_SORT_FROM ? undefined : ctx.env.STROM_WORKER;
    if (!opts.queue && !(await personSays(ctx, tree, { files: ask.files, text: ask.text }, ["strom material sort", ...ask.files, ...(ask.text ? ["--text", JSON.stringify(ask.text)] : [])].join(" ")))) return notSorted(ctx, ask.files);
    let s = queueSort(tree, ask, { lang: tree.lang, from });
    if (!opts.queue) s = await sortNow(ctx, tree, s, opts);
    return { text: said(tree, s), data: shownData(tree, s), exitCode: s.state === "failed" ? 1 : 0 };
  },
});

register({
  path: ["material", "show"],
  summary: "What a sort of the material proposed (or the sorts kept here)",
  group: "inputs",
  tree: true,
  description:
    "A sort's state (queued, working, done, failed, cancelled) and, when done, its proposals as the research is now:\none the person has since given or taken off is left out. Without an ID: the sorts kept here.\n" +
    `A run of the Strom app (run-…: more than ${SORT_MOST_FILES} files asked at once, sorted in parts of ${SORT_MOST_FILES}): its state, its files\n` +
    "done and its parts (sort-…), each part's proposals shown by its own ID.",
  args: [{ name: "id", description: "the sort: sort-…; or a run of the Strom app: run-…" }],
  options: [],
  examples: ["strom material show", "strom material show sort-20260101120000-ab12", "strom material show run-20260101120000-cd34"],
  run: async (ctx: Context, { args }) => {
    const tree = ctx.tree();
    if (args[0] && RUN_ID.test(args[0].trim())) {
      const run = runForApp(args[0].trim(), runOf(tree, args[0].trim()));
      return { text: runSaid(run), data: run };
    }
    if (args[0]) {
      const s = sortOf(tree, args[0].trim());
      return { text: said(tree, s), data: shownData(tree, s) };
    }
    const all = listSorts(tree.root).map(shownSort);
    return {
      text: all.length ? lines(...all.map((s) => `${s.id} · ${s.state} · ${counted(s.files.length, "file")}${partSaid(s)}${s.proposals ? ` · ${counted(s.proposals.length, "proposal")}` : ""}`)) : "no sorts here",
      data: { sorts: all.map((s) => ({ id: s.id, state: s.state, files: s.files, at: s.at, ...(s.reason ? { reason: s.reason } : {}), ...(s.run !== undefined ? { run: s.run, part: s.part, parts: s.parts } : {}) })) },
    };
  },
});

register({
  path: ["material", "cancel"],
  summary: "Stop a sort of the material: its readers stopped, nothing proposed",
  group: "inputs",
  tree: true,
  description:
    "A sort queued is cancelled at once; one at work: its readers are stopped (within a second or two) and it ends cancelled.\n" +
    "A run of the Strom app (run-…): its part at work stopped, its parts queued cancelled, those done kept with their\nproposals; one part alone: its own ID (sort-…).",
  args: [{ name: "id", description: "the sort: sort-…; or a run of the Strom app: run-…", required: true }],
  options: [],
  examples: ["strom material cancel sort-20260101120000-ab12", "strom material cancel run-20260101120000-cd34"],
  run: async (ctx: Context, { args }) => {
    const tree = ctx.tree();
    if (RUN_ID.test(args[0]!.trim())) {
      const id = args[0]!.trim();
      for (const s of runOf(tree, id)) cancelSort(tree.root, s);
      const run = runForApp(id, runOf(tree, id));
      return { text: runSaid(run), data: run };
    }
    const s = cancelSort(tree.root, sortOf(tree, args[0]!.trim()));
    return { text: `${s.id} · ${s.state}`, data: { id: s.id, state: s.state } };
  },
});
