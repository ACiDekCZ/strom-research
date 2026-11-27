// strom sync as-import: a send of the Strom app that was a family tree taken over (an import or a merge in the app), told
// so by the person once (1127). The Strom app's sends made before it marked what came of an import (_STROM_IMPORT) wrote
// such people as the person's own — origin `{by: "user"}`, the app's ✓ "confirmed by a person" — and neither the app nor
// the research can tell it any more by itself. The person can: this send was a family tree taken over.
//
// Which values: only those the send wrote that are the same now — told by the research's history alone, as originfix's
// treeValues tells a family tree taken in: the commit of the sync (the one that added its input), each of its people and
// families right after it, before it and now. A value in the record after it, not before it, the same now (a fact: its
// date, place and value; a name: given name and surname; the sex), its origin exactly the person's own (no tree, source
// or parts), nothing kept to put back (`was`, `sexWas`), not confirmed against a scan, neither it nor its owner withdrawn
// or merged. Each becomes the import's: one source of that send's family tree (made once, used again), cited first; the
// send's citation stays; value and status as they are. Nothing else changes.
//
// The research is backed up first (core/backup.ts backupTreeOnce, as core/notefix.ts) when there is something to write.
// One operation, one commit; what was set is kept for its undo in SEND_IMPORTS_FILE (sealed as the rest of quality/), and
// with it the person's answer for each send — "import" (taken over) or "own" (written by hand): never asked again.

import fs from "node:fs";
import path from "node:path";
import type { Citation, Event, Family, Name, Person, Source, ValueOrigin } from "./model.ts";
import { RECORD_TYPES } from "./model.ts";
import { canonicalize } from "./json.ts";
import * as git from "./git.ts";
import { now, VERSION, type Tree } from "./tree.ts";
import { nextImportKey } from "./origin.ts";
import { phrase } from "./phrases.ts";
import { displayName, gedcomName } from "./people.ts";
import { findEventOwner } from "./actions.ts";
import { backupsMade, backupTreeOnce, type BackupRecord } from "./backup.ts";
import { Settings } from "./config.ts";
import { UsageError } from "./errors.ts";
import type { SyncInput } from "./sync.ts";
import { ui } from "../cli/ui.ts";
import { humanDay } from "../cli/human.ts";

/** Where the command keeps what it set (for --undo) and the person's answer of each send. */
export const SEND_IMPORTS_FILE = "quality/send-imports.json";

/** The person's answer of a send: a family tree taken over, or written by hand. */
export type SendAnswer = "import" | "own";

/** Why a value the send wrote stays as it is. */
export type SendStay = "changed" | "confirmed" | "was" | "other";

/** A value a send wrote (in the record after its commit, not before it). */
export interface SendValue {
  what: "fact" | "name" | "sex";
  /** The person or family it is of. */
  owner: string;
  /** The fact (E…), the name (N:P…:n), the sex (SEX:P…). */
  ref: string;
  /** NAME, SEX or the fact's kind (BIRT…). */
  kind: string;
  /** A name: its place among the person's names now and as it is written (Given /Surname/). */
  index?: number;
  name?: string;
  /** Why it stays (none: it becomes the import's). */
  stay?: SendStay;
  /** The import's already, by this command (an earlier --apply). */
  done?: true;
}

export interface SendPlan {
  input: string;
  /** The day of the send (YYYY-MM-DD). */
  day: string;
  /** The people the send added. */
  persons: number;
  change: { values: number; persons: number; names: number; sexes: number; facts: number };
  stay: { values: number; changed: number; confirmed: number; was: number; other: number };
  /** Marked by this command already. */
  done: number;
  /** Three people of the send whose values change, in the order it added them. */
  samples: { id: string; name: string; values: string[] }[];
  values: SendValue[];
  answer?: SendAnswer;
  /** The source of the send's family tree, where this command made one. */
  source?: string;
}

/** One value set: what it was and what the command wrote (origin and citations), to be put back only while it is so. */
type SendMark =
  | { kind: "fact"; owner: string; event: string; before: { origin?: Event["origin"]; citations: Citation[] }; after: { origin: Event["origin"]; citations: Citation[] } }
  | { kind: "name"; person: string; index: number; name: string; before: { origin?: Name["origin"]; citations?: Citation[] }; after: { origin: Name["origin"]; citations?: Citation[] } }
  | { kind: "sex"; person: string; before: { origin?: Person["sexOrigin"] }; after: { origin: Person["sexOrigin"] } };

interface SendImportsFile {
  v: 1;
  /** Each --apply, newest last; an --undo takes its input's runs off. */
  runs: { input: string; at: string; version: string; source: string; created?: true; items: SendMark[] }[];
  /** The source of each send's family tree this command made (kept after an undo: used again, never one more). */
  sources: Record<string, string>;
  /** The person's answer of each send, the last one. */
  answers: { input: string; answer: SendAnswer; at: string }[];
}

function readFile(tree: Tree): SendImportsFile {
  try {
    const f = JSON.parse(fs.readFileSync(path.join(tree.root, ...SEND_IMPORTS_FILE.split("/")), "utf8")) as Partial<SendImportsFile>;
    return {
      v: 1,
      runs: Array.isArray(f.runs) ? f.runs : [],
      sources: f.sources && typeof f.sources === "object" ? f.sources : {},
      answers: Array.isArray(f.answers) ? f.answers : [],
    };
  } catch {
    return { v: 1, runs: [], sources: {}, answers: [] };
  }
}

const fileContent = (f: SendImportsFile) => JSON.stringify(f, null, 2) + "\n";

/** The person's answer of a send (strom sync as-import --apply: import, --own: own), none yet: undefined. */
export function importAnswered(tree: Tree, input: string): SendAnswer | undefined {
  return readFile(tree).answers.filter((a) => a.input === input).pop()?.answer;
}

/**
 * A send What waits asks about (1127, feature waiting.import): "did these people come of a family tree?" — a sync of the
 * Strom app (not taken back) that added at least `least` people (sync.importAsk), at least one of them with a name still
 * the person's own and nothing more ({by: "user"}) that cites a send of the app, and no answer yet (neither --apply nor
 * --own). Worked out cheaply, without the history (/status asks often): the preview (sendPlan) reads the history.
 */
export interface ImportOffer {
  input: string;
  /** When the send came (its input's time) and its day (YYYY-MM-DD). */
  at: string;
  day: string;
  /** The people the send added. */
  persons: number;
  /** Three of them whose name is still as the send wrote it (the person's own), in the order it added them. */
  samples: { id: string; name: string }[];
}

/** The sends What waits asks about, oldest first (none with `least` 0); with `only`, that send alone. */
export function importOffers(tree: Tree, least: number, only?: string): ImportOffer[] {
  if (!Number.isInteger(least) || least < 1) return [];
  const inputs = only ? [tree.get<SyncInput>(only)].filter((i): i is SyncInput => !!i) : tree.list<SyncInput>("input");
  const sends = inputs.filter((i) => i.type === "input" && !!i.sync && !i.sync.undone && (i.sync.applied?.length ?? 0) >= least);
  if (!sends.length) return [];
  const answered = new Set(readFile(tree).answers.map((a) => a.input));
  const known = new Map<string, boolean>();
  /** A source of a send of the app (its input a sync's): the day's "Edits in the Strom app". */
  const ofSend = (id: string) => {
    let v = known.get(id);
    if (v === undefined) {
      const src = tree.get<Source>(id);
      const i = src?.type === "source" && src.input ? tree.get<SyncInput>(src.input) : undefined;
      v = !!i && i.type === "input" && !!i.sync;
      known.set(id, v);
    }
    return v;
  };
  const out: ImportOffer[] = [];
  for (const input of sends) {
    if (answered.has(input.id)) continue;
    const added = [...new Set((input.sync!.applied ?? []).filter((a) => a.do === "person.add" && /^P\d+$/u.test(a.id)).map((a) => a.id))];
    if (added.length < least) continue;
    const samples: ImportOffer["samples"] = [];
    for (const id of added) {
      const p = tree.get<Person>(id);
      if (!p || p.type !== "person" || p.retracted || p.mergedInto) continue;
      if (!p.names.some((n) => plainUser(n.origin) && !n.confirmed && !n.was && (n.citations ?? []).some((c) => ofSend(c.source)))) continue;
      samples.push({ id, name: displayName(p) });
      if (samples.length === 3) break;
    }
    if (!samples.length) continue;
    out.push({ input: input.id, at: input.created, day: dayOf(input), persons: added.length, samples });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at) || byId(a.input, b.input));
}

const withAnswer = (f: SendImportsFile, input: string, answer: SendAnswer): SendImportsFile => ({
  ...f,
  answers: [...f.answers.filter((a) => a.input !== input), { input, answer, at: now() }],
});

/** An input as typed (I2, i0002, 2) — a send of the app (a sync's, not undone), else a UsageError with what to run. */
export function sendInput(tree: Tree, typed: string, undoneToo = false): SyncInput {
  const id = typed.trim().toUpperCase().replace(/^I?(\d+)$/u, (_, n: string) => `I${n.padStart(4, "0")}`);
  const input = tree.get<SyncInput>(id);
  if (!input || input.type !== "input" || !input.sync)
    throw new UsageError(`${typed} is not a sync`, { hint: "strom input list — a sync's input says so (strom sync wrote it)", code: "sync.not-sync", params: { input: typed } });
  if (input.sync.undone && !undoneToo)
    throw new UsageError(`${id} was taken back (strom sync undo)`, { hint: "strom input list — a sync not taken back", code: "sync.undone", params: { input: id } });
  return input;
}

/** The day of a send. */
const dayOf = (input: SyncInput) => input.created.slice(0, 10);

/** A record of the history (data/persons|families/<id>.json at a commit), undefined when it was not there. */
function recordThen(text: string | undefined): (Person | Family) | undefined {
  if (text === undefined) return undefined;
  try {
    const r = JSON.parse(text) as Person | Family;
    return r && (r.type === "person" || r.type === "family") && Array.isArray(r.events) ? r : undefined;
  } catch {
    return undefined;
  }
}

const sameFact = (a: Pick<Event, "date" | "place" | "value">, b: Pick<Event, "date" | "place" | "value">) =>
  (a.date ?? "") === (b.date ?? "") && (a.place ?? "") === (b.place ?? "") && (a.value ?? "") === (b.value ?? "");
const sameName = (a: Pick<Name, "given" | "surname">, b: Pick<Name, "given" | "surname">) => a.given === b.given && a.surname === b.surname;
/** The person's own value and nothing more: `{by: "user"}` exactly. */
const plainUser = (o: ValueOrigin<string> | undefined) => !!o && o.by === "user" && Object.keys(o).length === 1;
const same = (a: unknown, b: unknown) => JSON.stringify(canonicalize(a ?? null)) === JSON.stringify(canonicalize(b ?? null));

/** The people and families a sync wrote of (its applied steps), in the order it wrote them; the people it added apart. */
function sendOwners(tree: Tree, input: SyncInput): { owners: string[]; added: string[] } {
  const owners: string[] = [];
  const added: string[] = [];
  for (const a of input.sync?.applied ?? []) {
    let id: string | undefined;
    if (/^[PF]\d+$/u.test(a.id)) id = a.id;
    else if (/^E\d+$/u.test(a.id))
      try {
        id = findEventOwner(tree, a.id).owner.id;
      } catch {
        id = undefined;
      }
    if (id && !owners.includes(id)) owners.push(id);
    if (a.do === "person.add" && !added.includes(a.id)) added.push(a.id);
  }
  return { owners, added };
}

/** The commit that took the sync in (the one that added its input's record), and the one before it. */
function sendCommit(tree: Tree, input: SyncInput): { commit: string; parent?: string } | undefined {
  const log = git.runGit(tree.root, ["log", "--diff-filter=A", "--format=%H", "--", `data/${RECORD_TYPES.input.dir}/${input.id}.json`]);
  const commit = log.status === 0 ? log.stdout.split("\n").map((l) => l.trim()).filter(Boolean).pop() : undefined;
  if (!commit) return undefined;
  const parent = git.runGit(tree.root, ["rev-parse", "--verify", "--quiet", `${commit}^`]);
  return { commit, ...(parent.status === 0 && parent.stdout.trim() ? { parent: parent.stdout.trim() } : {}) };
}

/**
 * What the command would do of a send: each value it wrote, whether it becomes the import's or why it stays — read only,
 * nothing written. Told by the research's history alone; none without it.
 */
export function sendPlan(tree: Tree, input: SyncInput): SendPlan {
  const file = readFile(tree);
  const ours = file.sources[input.id];
  const { owners, added } = sendOwners(tree, input);
  const values: SendValue[] = [];
  const at = sendCommit(tree, input);
  if (at && owners.length) {
    const rel = (id: string) => `data/${RECORD_TYPES[id.startsWith("F") ? "family" : "person"].dir}/${id}.json`;
    const files = owners.map(rel);
    let then = new Map<string, string | undefined>();
    let before = new Map<string, string | undefined>();
    try {
      then = git.showFiles(tree.root, at.commit, files);
      if (at.parent) before = git.showFiles(tree.root, at.parent, files);
    } catch {
      then = new Map();
    }
    /** Why a value of the person's own stays, or none: it becomes the import's (or is already, by this command). */
    const verdict = (origin: ValueOrigin<string> | undefined, confirmed: unknown, was: unknown): { stay?: SendStay; done?: true } =>
      confirmed ? { stay: "confirmed" } : was ? { stay: "was" } : plainUser(origin) ? {} : origin?.by === "import" && !!ours && origin.source === ours ? { done: true } : { stay: "other" };
    for (const id of owners) {
      const was = recordThen(then.get(rel(id)));
      if (!was) continue;
      const prior = recordThen(before.get(rel(id)));
      const cur = tree.get<Person | Family>(id);
      const gone = !cur || cur.type !== was.type || !!cur.retracted || !!cur.mergedInto;
      if (was.type === "person") {
        const p = !gone && cur!.type === "person" ? cur : undefined;
        const priorNames = prior?.type === "person" ? prior.names : [];
        for (const n of was.names ?? []) {
          if (priorNames.some((m) => sameName(m, n))) continue;
          const index = p ? p.names.findIndex((m) => sameName(m, n)) : -1;
          const m = index >= 0 ? p!.names[index]! : undefined;
          const v: SendValue = { what: "name", owner: id, ref: `N:${id}:${index + 1}`, kind: "NAME", ...(index >= 0 ? { index } : {}), name: gedcomName(m ?? n) };
          values.push(m ? { ...v, ...verdict(m.origin, m.confirmed, m.was) } : { ...v, stay: "changed" });
        }
        if (was.sex && was.sex !== "U" && !(prior?.type === "person" && prior.sex === was.sex)) {
          const v: SendValue = { what: "sex", owner: id, ref: `SEX:${id}`, kind: "SEX" };
          values.push(p && p.sex === was.sex ? { ...v, ...verdict(p.sexOrigin, undefined, p.sexWas) } : { ...v, stay: "changed" });
        }
      }
      for (const e of was.events) {
        if (e.retracted || prior?.events.some((x) => x.id === e.id)) continue;
        const now = gone ? undefined : cur!.events.find((x) => x.id === e.id);
        const v: SendValue = { what: "fact", owner: id, ref: e.id, kind: e.kind };
        values.push(now && !now.retracted && sameFact(e, now) ? { ...v, ...verdict(now.origin, now.confirmed, now.was) } : { ...v, stay: "changed" });
      }
    }
  }
  const change = values.filter((v) => !v.stay && !v.done);
  const stays = values.filter((v) => v.stay);
  const n = (list: SendValue[], what: SendValue["what"]) => list.filter((v) => v.what === what).length;
  const reason = (r: SendStay) => stays.filter((v) => v.stay === r).length;
  const changedPeople = [...new Set(change.filter((v) => v.owner.startsWith("P")).map((v) => v.owner))];
  const order = [...added, ...changedPeople.filter((p) => !added.includes(p))];
  const samples = order
    .filter((p) => changedPeople.includes(p))
    .slice(0, 3)
    .map((p) => ({ id: p, name: displayName(tree.get<Person>(p)!), values: [...new Set(change.filter((v) => v.owner === p).map((v) => v.kind))] }));
  const answer = importAnswered(tree, input.id);
  return {
    input: input.id,
    day: dayOf(input),
    persons: added.length,
    change: { values: change.length, persons: changedPeople.length, names: n(change, "name"), sexes: n(change, "sex"), facts: n(change, "fact") },
    stay: { values: stays.length, changed: reason("changed"), confirmed: reason("confirmed"), was: reason("was"), other: reason("other") },
    done: values.filter((v) => v.done).length,
    samples,
    values,
    ...(answer ? { answer } : {}),
    ...(ours ? { source: ours } : {}),
  };
}

/** A local date and time for the backup's README. */
function when(d: Date): string {
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * The backup of this research before a send's values are marked of its family tree: of this research and the settings
 * (backupTreeOnce, as core/notefix.ts backupBeforeNotes), kept in the user config. None with no home of the research
 * configured; one of the last day for this version that holds it already: that one (`made` false). Throws when it cannot
 * be made, or the research could not be copied (written all the while).
 */
export function backupBeforeSendImport(tree: Tree, input: string): { backup: BackupRecord; made: boolean } | undefined {
  const settings = new Settings(tree.env, {});
  const home = settings.home()?.value;
  if (!home) return undefined;
  const lang = settings.lang(tree.config).value;
  const made = backupTreeOnce({
    home,
    env: tree.env,
    root: tree.root,
    id: tree.config.id,
    transition: { from: VERSION, to: VERSION },
    readme: ui(lang, "ui.backup.readme.asimport", { date: when(new Date()), to: VERSION, input, tree: tree.config.name }),
    research: [settings.trees()?.value, settings.shared()?.value].filter((p): p is string => !!p),
    record: (b, before) => {
      settings.reload();
      settings.config.backups = [...before, b];
      settings.save();
    },
  });
  if (made?.skipped?.length) throw new UsageError("the backup could not copy the research: it was being written all the while — nothing marked", { hint: "try again when nothing else writes the research", code: "backup.skipped" });
  if (made) return { backup: made, made: true };
  const last = backupsMade(tree.env).filter((b) => b.to === VERSION).pop();
  return last ? { backup: last, made: false } : undefined;
}

const byId = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/**
 * The send's values the plan finds the person's own marked of its family tree, the person's answer "import" kept — one
 * operation (nothing found and answered so already: none). Inside withTreeLock, after the backup.
 */
export function applySendImport(tree: Tree, input: SyncInput): { values: number; persons: number; source?: string; created: boolean; plan: SendPlan } {
  const plan = sendPlan(tree, input);
  const file = readFile(tree);
  const todo = plan.values.filter((v) => !v.stay && !v.done);
  if (!todo.length) {
    if (importAnswered(tree, input.id) !== "import")
      tree.putMany([], [{ rel: SEND_IMPORTS_FILE, content: fileContent(withAnswer(file, input.id, "import")) }], {
        op: "sync.as-import",
        targets: [input.id],
        summary: `Sync ${input.id} told a family tree taken over in the Strom app: nothing of it left to mark (sync as-import)`,
      });
    return { values: 0, persons: 0, created: false, plan };
  }
  const records = new Map<string, Person | Family | Source>();
  const of = <T extends Person | Family | Source>(id: string): T => {
    if (!records.has(id)) records.set(id, structuredClone(tree.get<T>(id)!));
    return records.get(id) as T;
  };
  // the source of the send's family tree: the one made before (back if an undo withdrew it), else a new one
  const known = file.sources[input.id] ? tree.get<Source>(file.sources[input.id]!) : undefined;
  let created = false;
  let source: Source;
  if (known?.type === "source") {
    source = of<Source>(known.id);
    if (source.retracted && source.retracted.reason === undoneReason(input.id)) {
      delete source.retracted;
      created = true;
    }
  } else {
    const t = now();
    const day = dayOf(input);
    const lang = tree.config.lang;
    source = {
      id: tree.allocate(RECORD_TYPES.source.prefix),
      type: "source",
      kind: "family-tree",
      title: phrase(lang, "send.import.source", { day: humanDay(`${day}T12:00:00.000Z`, lang) }),
      input: input.id,
      information: "secondary",
      form: "authored",
      imported: { key: nextImportKey(tree), program: "Strom", at: day },
      notes: [],
      created: t,
      updated: t,
    } as Source;
    records.set(source.id, source);
    created = true;
  }
  const s = source.id;
  // a source the person deleted (spec 117): its values the import's, citing it never
  const cites = !source.deleted;
  const items: SendMark[] = [];
  for (const v of todo) {
    if (v.what === "fact") {
      const o = of<Person | Family>(v.owner);
      const e = o.events.find((x) => x.id === v.ref)!;
      const origin: Event["origin"] = { by: "import", source: s };
      const citations = cites && !e.citations.some((c) => c.source === s) ? [{ source: s, locator: e.kind }, ...e.citations] : e.citations;
      items.push({ kind: "fact", owner: o.id, event: e.id, before: { ...(e.origin ? { origin: e.origin } : {}), citations: e.citations }, after: { origin, citations } });
      e.origin = origin;
      e.citations = citations;
    } else if (v.what === "name") {
      const p = of<Person>(v.owner);
      const n = p.names[v.index!]!;
      const origin: Name["origin"] = { by: "import", source: s };
      const had = n.citations ?? [];
      const citations = cites && !had.some((c) => c.source === s) ? [{ source: s, locator: "name" }, ...had] : had;
      items.push({ kind: "name", person: p.id, index: v.index!, name: gedcomName(n), before: { ...(n.origin ? { origin: n.origin } : {}), ...(n.citations ? { citations: n.citations } : {}) }, after: { origin, ...(citations.length ? { citations } : {}) } });
      n.origin = origin;
      if (citations.length) n.citations = citations;
    } else {
      const p = of<Person>(v.owner);
      const origin: Person["sexOrigin"] = { by: "import", source: s };
      items.push({ kind: "sex", person: p.id, before: { ...(p.sexOrigin ? { origin: p.sexOrigin } : {}) }, after: { origin } });
      p.sexOrigin = origin;
    }
  }
  const persons = new Set(todo.filter((v) => v.owner.startsWith("P")).map((v) => v.owner)).size;
  const next: SendImportsFile = withAnswer(
    { ...file, runs: [...file.runs, { input: input.id, at: now(), version: VERSION, source: s, ...(created ? { created: true as const } : {}), items }], sources: { ...file.sources, [input.id]: s } },
    input.id,
    "import",
  );
  const count = (what: SendValue["what"]) => todo.filter((v) => v.what === what).length;
  tree.putMany([...records.values()], [{ rel: SEND_IMPORTS_FILE, content: fileContent(next) }], {
    op: "sync.as-import",
    targets: [input.id, ...[...records.keys()].sort(byId)],
    summary:
      `Sync ${input.id} told a family tree taken over in the Strom app: ${todo.length} values of ${persons} people the import's ${s} ` +
      `(${count("name")} names, ${count("sex")} sexes, ${count("fact")} facts), not the person's edits — origin and citation alone, value and status kept (sync as-import; undo: strom sync as-import ${input.id} --undo)`,
    reason: `the person told sync ${input.id} a family tree taken over`,
  });
  return { values: todo.length, persons, source: s, created, plan };
}

/** Why the command's source was withdrawn by its undo (and so is used again). */
const undoneReason = (input: string) => `sync as-import ${input} undone`;

/**
 * What the command set of a send put back — each value where it is still as the command wrote it (changed since: left);
 * the source it made withdrawn where nothing cites it any more. The answer stays (never asked again). One operation;
 * nothing set: none. Inside withTreeLock.
 */
export function undoSendImport(tree: Tree, input: SyncInput): { restored: number; left: number; persons: number } {
  const file = readFile(tree);
  const runs = file.runs.filter((r) => r.input === input.id);
  if (!runs.length) return { restored: 0, left: 0, persons: 0 };
  const records = new Map<string, Person | Family | Source>();
  const of = <T extends Person | Family | Source>(id: string): T | undefined => {
    if (!records.has(id)) {
      const r = tree.get<T>(id);
      if (!r) return undefined;
      records.set(id, structuredClone(r));
    }
    return records.get(id) as T;
  };
  const touched = new Set<string>();
  let restored = 0;
  let left = 0;
  const people = new Set<string>();
  // newest first: a value set twice (an apply after an undo that left it) put back as it was before both
  for (const it of runs.flatMap((r) => r.items).reverse()) {
    if (it.kind === "fact") {
      const o = of<Person | Family>(it.owner);
      const e = o?.events.find((x) => x.id === it.event);
      if (!o || !e || !same(e.origin, it.after.origin) || !same(e.citations, it.after.citations)) {
        left++;
        continue;
      }
      if (it.before.origin) e.origin = it.before.origin;
      else delete e.origin;
      e.citations = it.before.citations;
      touched.add(o.id);
      if (o.type === "person") people.add(o.id);
    } else if (it.kind === "name") {
      const p = of<Person>(it.person);
      const at = p ? (p.names[it.index] && same(p.names[it.index]!.origin, it.after.origin) && same(p.names[it.index]!.citations ?? [], it.after.citations ?? []) ? it.index : p.names.findIndex((n) => gedcomName(n) === it.name && same(n.origin, it.after.origin) && same(n.citations ?? [], it.after.citations ?? []))) : -1;
      const n = p && at >= 0 ? p.names[at] : undefined;
      if (!p || !n) {
        left++;
        continue;
      }
      if (it.before.origin) n.origin = it.before.origin;
      else delete n.origin;
      if (it.before.citations) n.citations = it.before.citations;
      else delete n.citations;
      touched.add(p.id);
      people.add(p.id);
    } else {
      const p = of<Person>(it.person);
      if (!p || !same(p.sexOrigin, it.after.origin)) {
        left++;
        continue;
      }
      if (it.before.origin) p.sexOrigin = it.before.origin;
      else delete p.sexOrigin;
      touched.add(p.id);
      people.add(p.id);
    }
    restored++;
  }
  // the source this command made: withdrawn where nothing of the tree cites it any more
  for (const s of new Set(runs.filter((r) => r.created).map((r) => r.source))) {
    const src = of<Source>(s);
    if (!src || src.type !== "source" || src.retracted) continue;
    const cited = (x: { citations?: Citation[] }) => !!x.citations?.some((c) => c.source === s);
    const live = (id: string) => (records.has(id) ? (records.get(id) as Person | Family) : tree.get<Person | Family>(id));
    const owners = [...tree.list<Person>("person"), ...tree.list<Family>("family")].map((o) => live(o.id)!).filter((o) => !o.retracted);
    const origin = (x: { origin?: ValueOrigin<string> }) => x.origin?.source === s;
    if (owners.some((o) => o.events.some((e) => !e.retracted && (cited(e) || origin(e))) || (o.type === "person" && (o.names.some((n) => cited(n) || origin(n)) || o.sexOrigin?.source === s)))) continue;
    src.retracted = { at: now(), reason: undoneReason(input.id) };
    touched.add(s);
  }
  const next: SendImportsFile = { ...file, runs: file.runs.filter((r) => r.input !== input.id) };
  tree.putMany([...records.values()].filter((r) => touched.has(r.id)), [{ rel: SEND_IMPORTS_FILE, content: fileContent(next) }], {
    op: "sync.as-import.undo",
    targets: [input.id, ...[...touched].sort(byId)],
    summary: `Sync ${input.id} as a family tree taken over undone: ${restored} values the person's own again${left ? `, ${left} changed since left as they are` : ""} (sync as-import --undo; the answer kept)`,
  });
  return { restored, left, persons: people.size };
}

/**
 * The person's answer "own": the send was written by hand — nothing changes, the answer kept (never asked again). A send
 * whose values this command marked (not undone) is refused: --undo first. Answered so already: nothing written.
 */
export function answerOwn(tree: Tree, input: SyncInput): { written: boolean } {
  const file = readFile(tree);
  if (file.runs.some((r) => r.input === input.id))
    throw new UsageError(`${input.id} is marked a family tree taken over — take that back first`, { hint: `strom sync as-import ${input.id} --undo`, code: "sync.as-import.applied", params: { input: input.id } });
  if (importAnswered(tree, input.id) === "own") return { written: false };
  tree.putMany([], [{ rel: SEND_IMPORTS_FILE, content: fileContent(withAnswer(file, input.id, "own")) }], {
    op: "sync.as-import.own",
    targets: [input.id],
    summary: `Sync ${input.id} told written by hand in the Strom app, not a family tree taken over: nothing changed (sync as-import --own)`,
  });
  return { written: true };
}
