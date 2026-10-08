// A batch of material from the Strom app (the app's ZADANI_VYZKUM_app-vstup-dat.md, step C2): many files at once — a
// folder, a ZIP, a box of the family's papers — sent through the bridge one by one (PUT /media/<sha256> with
// X-Strom-Batch and X-Strom-Path), kept like any original (the shared media store, never git), and sorted later by the
// agent: when the app says the batch is whole (POST /batch/<id>/done), or a day after its last file, it becomes intake
// tasks of some 25 files each, by the folders the files came in. What a batch is lives in .strom/batches/<id>.json
// (the tree's working folder, not its data); its inputs carry the batch and their path in it.

import fs from "node:fs";
import path from "node:path";
import type { Input, Person, Session, Task } from "./model.ts";
import { create, update } from "./records.ts";
import { makeNote } from "./actions.ts";
import { phrase } from "./phrases.ts";
import { isArchive } from "./mode.ts";
import { UsageError } from "./errors.ts";
import type { Env } from "./paths.ts";
import type { Tree } from "./tree.ts";

/** A batch's mark, as the app makes it (a UUID, or letters, digits and "-"). */
export const BATCH_ID = /^[A-Za-z0-9-]{8,64}$/;
/** Where tasks to sort a batch come from. */
export const APP_BATCH_ORIGIN = "app:batch";
/** About so many files one sorting task takes (one session reads them). */
export const BATCH_TASK_FILES = 25;
/** A batch nobody said is whole is closed with what came, so long after its last file. */
export const BATCH_IDLE_MS = 24 * 60 * 60_000;
/** More images than this in one folder of a batch look like the scans of a book. */
const BOOK_IMAGES = 20;

export function batchLimits(env: Env): { files: number; bytes: number } {
  const n = (v: string | undefined, d: number) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
  return { files: n(env.STROM_BATCH_MAX_FILES, 5000), bytes: n(env.STROM_BATCH_MAX_BYTES, 20 * 1024 ** 3) };
}

export interface Batch {
  id: string;
  name?: string;
  /** The people the app said it is all of. */
  persons?: string[];
  created: string;
  updated: string;
  /** When it was closed: said whole by the app, or after a day without a file. */
  done?: string;
  /** "app": the app said it is whole; "idle": closed after a day. */
  closed?: "app" | "idle";
  /** How many files the app said it sends. */
  expected?: number;
  inputs: string[];
  /** Files the research had already (by content). */
  known: string[];
  bytes: number;
  /** Files not taken: their path in the batch and why. */
  refused: { path: string; why: string }[];
  /** ZIP files inside a ZIP: said, not unpacked. */
  nested: string[];
  tasks?: string[];
  /** The user's note to the whole batch (the app's "Note for the research"): told in each of its tasks. */
  note?: string;
}

const dirOf = (root: string) => path.join(root, ".strom", "batches");
const fileOf = (root: string, id: string) => path.join(dirOf(root), `${id}.json`);

export function readBatch(root: string, id: string): Batch | undefined {
  try {
    return JSON.parse(fs.readFileSync(fileOf(root, id), "utf8")) as Batch;
  } catch {
    return undefined;
  }
}

function writeBatch(root: string, b: Batch): void {
  fs.mkdirSync(dirOf(root), { recursive: true });
  const f = fileOf(root, b.id);
  fs.writeFileSync(`${f}.${process.pid}`, JSON.stringify(b, null, 2));
  fs.renameSync(`${f}.${process.pid}`, f);
}

export function listBatches(root: string): Batch[] {
  let names: string[] = [];
  try {
    names = fs.readdirSync(dirOf(root)).filter((n) => n.endsWith(".json"));
  } catch {
    return [];
  }
  return names
    .map((n) => readBatch(root, n.slice(0, -5)))
    .filter((b): b is Batch => !!b)
    .sort((a, b) => a.created.localeCompare(b.created));
}

/** A path in a batch as the app gives it: forward slashes, nothing above it, no hidden parts; undefined when none is left. */
export function batchPath(raw: string | undefined): string | undefined {
  const parts = (raw ?? "")
    .normalize("NFC")
    .replace(/\\/g, "/")
    .split("/")
    .map((p) => p.replace(/[\u0000-\u001f]/g, "").trim())
    .filter((p) => p && p !== "." && p !== "..");
  const out = parts.join("/").slice(0, 500);
  return out || undefined;
}

/** A batch to add to: made at its first file; one closed takes nothing more. */
export function openBatch(root: string, id: string): Batch {
  if (!BATCH_ID.test(id)) throw new UsageError(`not a batch: "${id.slice(0, 64)}"`, { code: "batch.bad-id", params: { batch: id.slice(0, 64) } });
  const b = readBatch(root, id);
  if (b?.done) throw new UsageError(`the batch ${id} is closed already`, { hint: "send the rest as a new batch", code: "batch.closed", params: { batch: id } });
  const t = new Date().toISOString();
  return b ?? { id, created: t, updated: t, inputs: [], known: [], bytes: 0, refused: [], nested: [] };
}

/** What came into a batch, noted (the caller holds the tree lock). */
export function noteBatch(root: string, b: Batch, add: { input?: string; known?: string; bytes?: number; refused?: { path: string; why: string }; nested?: string }): Batch {
  const next: Batch = {
    ...b,
    updated: new Date().toISOString(),
    inputs: add.input && !b.inputs.includes(add.input) ? [...b.inputs, add.input] : b.inputs,
    known: add.known && !b.known.includes(add.known) ? [...b.known, add.known] : b.known,
    bytes: b.bytes + (add.bytes ?? 0),
    refused: add.refused ? [...b.refused, add.refused].slice(-500) : b.refused,
    nested: add.nested ? [...b.nested, add.nested].slice(-200) : b.nested,
  };
  writeBatch(root, next);
  return next;
}

/** Whether a batch has room for one more file of this size; why not, else undefined. */
export function batchFull(b: Batch, bytes: number, env: Env): string | undefined {
  return batchRoom(b, bytes, env)?.text;
}

/** Why a batch has no room for one more file of this size — the English words and, for the app, its code — else undefined. */
export function batchRoom(b: Batch, bytes: number, env: Env): { text: string; code: string; params: Record<string, string> } | undefined {
  const lim = batchLimits(env);
  if (b.inputs.length + b.known.length >= lim.files) return { text: `the batch has ${lim.files} files already (the most one takes)`, code: "batch.full-files", params: { batch: b.id, files: String(lim.files) } };
  const gb = String(Math.round(lim.bytes / 1024 ** 3));
  if (b.bytes + bytes > lim.bytes) return { text: `the batch would be larger than ${gb} GB (the most one takes)`, code: "batch.full-bytes", params: { batch: b.id, gb } };
  return undefined;
}

/** The folder of a file in its batch that it is sorted with: its first one (a ZIP's: the ZIP and its first one), else none. */
function folderOf(p: string | undefined): string {
  const parts = (p ?? "").split("/");
  if (parts.length < 2) return "";
  return /\.zip$/i.test(parts[0]!) && parts.length > 2 ? `${parts[0]}/${parts[1]}` : parts[0]!;
}

const IMAGE = /^image\//;

/**
 * Close a batch: its new files become intake tasks of some 25 each, by the folder they came in (the scans of a book —
 * many numbered images of one folder — said so in the task). In an archive the tasks wait put aside. The caller holds
 * the tree lock and commits.
 */
export function closeBatch(tree: Tree, id: string, opts: { name?: string | undefined; persons?: string[]; expected?: number | undefined; note?: string | undefined; why: "app" | "idle" }): Batch & { tasks: string[] } {
  const b = readBatch(tree.root, id);
  if (!b) throw new UsageError(`no batch ${id} here`, { hint: "strom input batch", code: "batch.none", params: { batch: id } });
  if (b.done) return { ...b, tasks: b.tasks ?? [] };
  const lang = tree.lang;
  const name = opts.name?.trim().slice(0, 120) || b.name || phrase(lang, "batch.unnamed");
  const persons = [...new Set([...(b.persons ?? []), ...(opts.persons ?? [])])];
  const note = opts.note?.replace(/[\p{Cc}]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, 500) || b.note;
  const inputs = b.inputs.map((i) => tree.get<Input>(i)).filter((i): i is Input => !!i && i.state === "new");
  // by folder, in the order they came; each folder in parts of about 25
  const byFolder = new Map<string, Input[]>();
  for (const i of inputs) byFolder.set(folderOf(i.path), [...(byFolder.get(folderOf(i.path)) ?? []), i]);
  const groups: { folder: string; files: Input[]; book: boolean }[] = [];
  for (const [folder, files] of byFolder) {
    const book = files.filter((i) => IMAGE.test(i.mime ?? "")).length > BOOK_IMAGES && files.filter((i) => /\d/.test(path.basename(i.path ?? i.name))).length > BOOK_IMAGES;
    const parts = Math.ceil(files.length / BATCH_TASK_FILES);
    const per = Math.ceil(files.length / parts);
    for (let k = 0; k < parts; k++) groups.push({ folder, files: files.slice(k * per, (k + 1) * per), book });
  }
  const who = persons.map((p) => tree.get<Person>(p)).filter((p): p is Person => !!p && !p.retracted);
  const whoText = who.map((p) => `${[p.names[0]?.given, p.names[0]?.surname].filter(Boolean).join(" ")} [${p.id}]`).join(", ");
  const tasks: string[] = [];
  groups.forEach((g, k) => {
    const what = phrase(lang, "batch.what", {
      name,
      part: k + 1,
      parts: groups.length,
      count: g.files.length,
      folder: g.folder || phrase(lang, "batch.top"),
      first: g.files[0]!.id,
      last: g.files.at(-1)!.id,
    });
    const t = create<Task>(
      tree,
      "task",
      {
        level: "intake",
        priority: 4,
        what,
        where: g.files.map((i) => i.id),
        why: [phrase(lang, "batch.why", { name, who: whoText || phrase(lang, "app.media.nobody") }), g.book ? phrase(lang, "batch.book") : "", note ? phrase(lang, "batch.note", { note }) : ""].filter(Boolean).join(" "),
        doneWhen: phrase(lang, "batch.done"),
        subject: [...g.files.map((i) => i.id), ...who.map((p) => p.id)],
        state: "open",
        origin: APP_BATCH_ORIGIN,
      } as never,
      (tid) => `+${tid} task "sort ${g.files.length} file(s) of the batch ${name.slice(0, 40)}"`,
    );
    tasks.push(t.id);
  });
  // the user's note to the batch on each of its files too, as theirs (found on Windows: only in the tasks' why)
  if (note && note !== b.note)
    for (const i of inputs)
      if (!i.notes.some((n) => n.text === note))
        update<Input>(tree, i.id, "input", (x) => ({ ...x, notes: [...x.notes, makeNote(tree, note)] }), { op: "input.note", summary: `${i.id}: the batch's note (the Strom app)` });
  const done: Batch = { ...b, name, ...(persons.length ? { persons } : {}), ...(opts.expected ? { expected: opts.expected } : {}), ...(note ? { note } : {}), done: new Date().toISOString(), closed: opts.why, tasks };
  writeBatch(tree.root, done);
  return { ...done, tasks };
}

/** Batches nobody said are whole, a day after their last file. */
export function idleBatches(root: string, now = Date.now()): string[] {
  return listBatches(root)
    .filter((b) => !b.done && now - Date.parse(b.updated) > BATCH_IDLE_MS)
    .map((b) => b.id);
}

/** The batches for the app (/status batches): each with how far it is sorted — the last 30 days', and any not sorted yet. */
export function batchStatus(tree: Tree): Record<string, unknown>[] {
  const month = Date.now() - 30 * 24 * 60 * 60_000;
  const out: Record<string, unknown>[] = [];
  for (const b of listBatches(tree.root)) {
    const inputs = b.inputs.map((i) => tree.get<Input>(i)).filter((i): i is Input => !!i);
    const sorted = inputs.filter((i) => i.sorted || i.state !== "new").length;
    if (Date.parse(b.updated) < month && sorted === inputs.length) continue;
    const persons = [...new Set(inputs.flatMap((i) => [...(i.persons ?? []), ...(i.sorted?.persons ?? [])]))];
    out.push({
      id: b.id,
      ...(b.name ? { name: b.name } : {}),
      state: b.done ? "closed" : "open",
      at: b.created,
      files: inputs.length,
      known: b.known.length,
      refused: b.refused.length,
      ...(b.nested.length ? { nested: b.nested.length } : {}),
      sorted,
      persons,
      tasks: b.tasks ?? [],
    });
  }
  return out;
}

/**
 * What sorting a batch costs, for the app to say before it is sent: a task takes about BATCH_TASK_FILES files; what one
 * costs is the research's own past intake sessions (three or more), else a typical one. In an archive nothing is sorted.
 */
export function batchEstimate(tree: Tree): Record<string, unknown> | null {
  if (isArchive(tree)) return null;
  const tasks = new Map(tree.list<Task>("task").map((t) => [t.id, t]));
  const costs = tree
    .list<Session>("session")
    .filter((s) => s.task && tasks.get(s.task)?.level === "intake" && !s.metrics?.costPartial && typeof s.metrics?.costUsd === "number")
    .map((s) => s.metrics!.costUsd!);
  const past = costs.length >= 3;
  const perTask = past ? costs.reduce((a, b) => a + b, 0) / costs.length : 1;
  return { filesPerTask: BATCH_TASK_FILES, perTask: Math.round(perTask * 100) / 100, currency: "USD", basis: past ? "past" : "typical" };
}
