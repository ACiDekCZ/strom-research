// The family's material the research keeps, for the Strom app to show (GET <token>/material): the files sent from the
// app or given by hand — one at a time for people, or in batches — with where each came from, whom it is of and what
// was found of it. An archive keeps them unsorted, and the app is the one place a person sees them again. Read only;
// the file itself comes by GET <token>/media/<sha>?file=1 or the link strom-research://media.

import fs from "node:fs";
import path from "node:path";
import type { Input, Person } from "./model.ts";
import { listBatches } from "./batches.ts";
import type { Tree } from "./tree.ts";

export interface MaterialFile {
  id: string;
  name: string;
  sha: string;
  mime?: string;
  bytes?: number;
  /** When it came. */
  at: string;
  from?: string;
  /** The people it is of: as the sender said, and as whoever sorted it found. */
  persons: string[];
  batch?: string;
  path?: string;
  /** The notes on it: the sender's own (by "user"), and what whoever sorted it wrote. */
  notes?: { at: string; by: string; text: string }[];
  state: Input["state"];
  sorted?: { as: string; persons?: string[]; source?: string; reason?: string };
  /** The source it became. */
  source?: string;
  /** Whether the file is on this computer (a research unpacked without its images: not). */
  here: boolean;
}

export interface MaterialBatch {
  id: string;
  name?: string;
  at: string;
  done?: string;
  files: number;
  persons: string[];
  note?: string;
}

/** A person as the research knows them now: a duplicate merged away is the one it went into. */
function live(tree: Tree, id: string): string {
  let p = tree.get<Person>(id);
  for (let i = 0; p?.mergedInto && i < 10; i++) p = tree.get<Person>(p.mergedInto);
  return p && !p.retracted ? p.id : id;
}

/** The family's files the research keeps (never the family trees sent, which are the research itself), oldest first. */
export function material(tree: Tree, shared: string | undefined, only: { person?: string; batch?: string } = {}): { files: MaterialFile[]; batches: MaterialBatch[] } {
  const batches = listBatches(tree.root);
  const batchPersons = new Map(batches.map((b) => [b.id, (b.persons ?? []).map((p) => live(tree, p))]));
  const person = only.person ? live(tree, only.person) : undefined;
  const files: MaterialFile[] = [];
  for (const i of tree.list<Input & { sync?: unknown }>("input")) {
    if (i.retracted || !i.sha || !i.file || i.sync || i.kind === "tree") continue;
    if (only.batch && i.batch !== only.batch) continue;
    const persons = [...new Set([...(i.persons ?? []), ...(i.sorted?.persons ?? [])].map((p) => live(tree, p)))];
    if (person && !persons.includes(person) && !(i.batch && batchPersons.get(i.batch)?.includes(person))) continue;
    const file = i.file.startsWith("inputs/") ? path.join(tree.root, i.file) : shared && i.file.startsWith("media:") ? path.join(shared, i.file.slice(6)) : undefined;
    const s = i.sorted;
    files.push({
      id: i.id,
      name: i.name,
      sha: i.sha,
      ...(i.mime ? { mime: i.mime } : {}),
      ...(typeof i.size === "number" ? { bytes: i.size } : {}),
      at: i.created,
      ...(i.from ? { from: i.from } : {}),
      persons,
      ...(i.batch ? { batch: i.batch } : {}),
      ...(i.path ? { path: i.path } : {}),
      ...(i.notes?.length ? { notes: i.notes.map((n) => ({ at: n.at, by: n.by, text: n.text })) } : {}),
      state: i.state,
      ...(s ? { sorted: { as: s.as, ...(s.persons?.length ? { persons: s.persons.map((p) => live(tree, p)) } : {}), ...(s.source ? { source: s.source } : {}), ...(s.reason ? { reason: s.reason } : {}) } } : {}),
      ...(i.source ? { source: i.source } : {}),
      here: !!file && fs.existsSync(file),
    });
  }
  files.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const counted = new Map<string, number>();
  for (const f of files) if (f.batch) counted.set(f.batch, (counted.get(f.batch) ?? 0) + 1);
  const out = batches
    .filter((b) => counted.has(b.id))
    .map((b) => ({
      id: b.id,
      ...(b.name ? { name: b.name } : {}),
      at: b.created,
      ...(b.done ? { done: b.done } : {}),
      files: counted.get(b.id)!,
      persons: batchPersons.get(b.id) ?? [],
      ...(b.note ? { note: b.note } : {}),
    }));
  return { files, batches: out };
}
