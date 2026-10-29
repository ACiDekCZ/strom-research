// strom fixes app-shapes: what a strom before 1.22.0 took for the user's edit in a send of the Strom app that only gave
// a period or an age in the app's own form (core/appshapes.ts) — found in what each sync wrote (its input's
// `sync.applied`) and set right by rules: a conflict of the user's edit closed for the research's value, a fact the send
// added beside the research's same one withdrawn (the research's put back where the user's word had withdrawn it), a
// lead's date or age the send corrected as it was. Nothing else. Free, one operation, kept for its undo (APP_SHAPES_FILE).

import fs from "node:fs";
import path from "node:path";
import { appAge, appDate, inApp, onlyAppShape } from "./appshapes.ts";
import type { Conflict, Event, Family, Person, TreeConfig } from "./model.ts";
import { inputPath } from "./media.ts";
import { phrase } from "./phrases.ts";
import { appKeepsPeriods } from "./stromapp.ts";
import { describe, type SyncInput } from "./sync.ts";
import { now, type Tree } from "./tree.ts";

/** Where the fix keeps what it changed, for its undo (sealed like the rest of quality/; travels with the research). */
export const APP_SHAPES_FILE = "quality/app-shapes.json";

/** A fact's date and ages as the fix sets them (only those it touches). */
export interface ShapedFields {
  date?: string;
  age?: string;
  ages?: Record<string, string>;
}

/**
 * One thing set right, with the sync (I…) that wrote it: a conflict closed (`conflict`), a fact the send added withdrawn
 * (`added`; `restore`: the research's same fact `beside` the send had withdrawn, put back), a lead's date or age put back
 * (`corrected`: `before` the research's, `after` the app's).
 */
export type ShapeFix =
  | { kind: "conflict"; input: string; conflict: string; owner: string; event: string; ours: string; theirs: string }
  | { kind: "added"; input: string; owner: string; event: string; beside: string; restore?: true; ours: string; theirs: string; status?: string }
  | { kind: "corrected"; input: string; owner: string; event: string; before: ShapedFields; after: ShapedFields; ours: string; theirs: string };

interface ShapesFile {
  v: 1;
  /** Each time the fix set things right, newest last. */
  runs: { at: string; version: string; items: ShapeFix[] }[];
}

const owners = (tree: Tree): (Person | Family)[] => [...tree.list<Person>("person"), ...tree.list<Family>("family")];
const kindOf = (k: string) => (k === "CHR" ? "BAPM" : k);
const said = (e: Pick<Event, "date" | "place" | "value" | "cause" | "age" | "house" | "ages">) => describe(e);
/** The same participants, or none in the added fact. */
const partsIn = (added: Event, ours: Event) =>
  (added.participants ?? []).every((p) => (ours.participants ?? []).some((o) => o.role === p.role && (p.person ? o.person === p.person : o.name === p.name)));

/** What the sync's `before` of a detail said (a JSON object of cause, age, house, ages:<id>), else nothing. */
function detailBefore(before: unknown): Record<string, string> | undefined {
  try {
    const d = typeof before === "string" ? (JSON.parse(before) as unknown) : before;
    return d && typeof d === "object" ? (d as Record<string, string>) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The version of the Strom app a sync's input names in its HEAD (2 VERS under 1 SOUR STROM), read from its first lines
 * only; another program's file, a JSON, a file gone: none.
 */
function inputAppVersion(tree: Tree, input: SyncInput): string | undefined {
  let text = input.text;
  if (text === undefined) {
    const file = inputPath(tree, input);
    if (!file) return undefined;
    try {
      const fd = fs.openSync(file, "r");
      try {
        const buf = Buffer.alloc(16384);
        text = buf.toString("utf8", 0, fs.readSync(fd, buf, 0, buf.length, 0));
      } finally {
        fs.closeSync(fd);
      }
    } catch {
      return undefined;
    }
  }
  const lines = text.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/);
  if (!/^\s*0\s+HEAD\s*$/.test(lines[0] ?? "")) return undefined;
  let app = false;
  for (const line of lines.slice(1)) {
    if (/^\s*0\s/.test(line)) break;
    if (/^\s*1\s/.test(line)) app = /^\s*1\s+SOUR\s+STROM\s*$/.test(line);
    else if (app) {
      const v = /^\s*2\s+VERS\s+(.+)$/.exec(line);
      if (v) return v[1]!.trim();
    }
  }
  return undefined;
}

/** What the fix would set right now, oldest sync first. */
export function appShapeFixes(tree: Tree): ShapeFix[] {
  const out: ShapeFix[] = [];
  const ownerOf = new Map<string, Person | Family>();
  for (const o of owners(tree)) if (!o.retracted && !(o as Person).mergedInto) for (const e of o.events) ownerOf.set(e.id, o);
  const eventOf = (id: string | undefined) => (id ? ownerOf.get(id)?.events.find((e) => e.id === id) : undefined);
  const seen = new Set<string>();
  const inputs = tree.list<SyncInput>("input").filter((i) => i.sync?.applied.length && !i.sync.undone);
  for (const input of inputs.sort((a, b) => a.id.localeCompare(b.id))) {
    // a send of an app that keeps a period and an age as the research wrote them (APP_KEEPS_PERIODS): such a change in
    // it was the user's own edit, never the app's shape
    if (appKeepsPeriods(inputAppVersion(tree, input))) continue;
    const applied = input.sync!.applied;
    const withdrawn = new Set(applied.filter((a) => a.do === "event.retract").map((a) => a.id));
    for (const a of applied) {
      if (seen.has(`${a.do}|${a.id}`)) continue;
      if (a.do === "conflict.add" || a.do === "conflict.edit") {
        const x = tree.get<Conflict>(a.id);
        const theirs = x?.claims[1];
        if (!x || x.state !== "open" || x.claims.length !== 2 || theirs?.note !== "the user's edit") continue;
        const id = x.edit?.event ?? /^the research: (E\d+)$/.exec(x.claims[0]?.note ?? "")?.[1];
        const e = eventOf(id);
        if (!e || e.retracted || !x.subject.includes(ownerOf.get(e.id)!.id)) continue;
        // the user's value is the research's fact as the app sends it back, and only so
        if (said(e) === theirs.value || said(inApp(e)) !== theirs.value) continue;
        seen.add(`${a.do}|${a.id}`);
        out.push({ kind: "conflict", input: input.id, conflict: x.id, owner: ownerOf.get(e.id)!.id, event: e.id, ours: said(e), theirs: theirs.value });
      } else if (a.do === "event.add") {
        const owner = ownerOf.get(a.id);
        const e = eventOf(a.id);
        if (!owner || !e || e.retracted) continue;
        // the research's same fact beside it — standing, or withdrawn by this sync for the user's word
        const beside = owner.events.find(
          (o) =>
            o.id !== e.id &&
            kindOf(o.kind) === kindOf(e.kind) &&
            (o.label ?? "") === (e.label ?? "") &&
            (!o.retracted || withdrawn.has(o.id)) &&
            onlyAppShape(o, e) &&
            said(inApp(o)) === said(inApp(e)) &&
            partsIn(e, o) &&
            e.citations.every((c) => c.source === input.source || o.citations.some((y) => y.source === c.source)),
        );
        if (!beside) continue;
        seen.add(`${a.do}|${a.id}`);
        out.push({ kind: "added", input: input.id, owner: owner.id, event: e.id, beside: beside.id, ...(beside.retracted ? { restore: true as const } : {}), ours: said(beside), theirs: said(e) });
      } else if (a.do === "event.edit" || a.do === "event.detail") {
        const owner = ownerOf.get(a.id);
        const e = eventOf(a.id);
        if (!owner || !e || e.retracted) continue;
        const before: ShapedFields = {};
        const after: ShapedFields = {};
        if (a.do === "event.edit") {
          const b = a.before as { date?: string; place?: string; value?: string } | undefined;
          // the date alone, its place and value as they were
          if (!b?.date || !e.date || (b.place ?? "") !== (e.place ?? "") || (b.value ?? "") !== (e.value ?? "")) continue;
          if (b.date === e.date || appDate(b.date) !== e.date) continue;
          [before.date, after.date] = [b.date, e.date];
        } else {
          const b = detailBefore(a.before);
          if (!b) continue;
          const keys = Object.keys(b);
          // only an age or a partner's age, each now the app's form of what it was
          const age = (was: string | undefined, is: string | undefined) => !!was && !!is && was !== is && appAge(was) === is;
          if (!keys.length || !keys.every((k) => (k === "age" ? age(b[k], e.age) : k.startsWith("ages:") ? age(b[k], e.ages?.[k.slice(5)]) : false))) continue;
          for (const k of keys)
            if (k === "age") [before.age, after.age] = [b[k]!, e.age!];
            else {
              before.ages = { ...before.ages, [k.slice(5)]: b[k]! };
              after.ages = { ...after.ages, [k.slice(5)]: e.ages![k.slice(5)]! };
            }
        }
        seen.add(`${a.do}|${a.id}`);
        out.push({ kind: "corrected", input: input.id, owner: owner.id, event: e.id, before, after, ours: said({ ...e, ...before, ages: { ...e.ages, ...before.ages } }), theirs: said(e) });
      }
    }
  }
  return out;
}

function readShapesFile(tree: Tree): ShapesFile {
  try {
    const f = JSON.parse(fs.readFileSync(path.join(tree.root, ...APP_SHAPES_FILE.split("/")), "utf8")) as Partial<ShapesFile>;
    return { v: 1, runs: Array.isArray(f.runs) ? f.runs : [] };
  } catch {
    return { v: 1, runs: [] };
  }
}

const fileContent = (f: ShapesFile) => JSON.stringify(f, null, 2) + "\n";

/** The same date and ages as `f`. */
const holds = (e: Event, f: ShapedFields) =>
  (f.date === undefined || e.date === f.date) && (f.age === undefined || e.age === f.age) && Object.entries(f.ages ?? {}).every(([k, a]) => e.ages?.[k] === a);

/** The status the research's fact had before the sync withdrew it (its `before`). */
function statusBefore(tree: Tree, it: Extract<ShapeFix, { kind: "added" }>): Event["status"] {
  const a = tree.get<SyncInput>(it.input)?.sync?.applied.find((x) => x.do === "event.retract" && x.id === it.beside);
  return (typeof a?.before === "string" && a.before !== "retracted" ? a.before : "probable") as Event["status"];
}

/**
 * Each item put on its records: set right (`set`, at the run's time `at`), or put back (`undo`: only what is still as
 * the run of `at` left it) — one changed since is left and counted. The records changed and the items done.
 */
function shape(
  tree: Tree,
  items: ShapeFix[],
  way: "set" | "undo",
  at: string,
  records = new Map<string, Person | Family | Conflict>(),
): { records: (Person | Family | Conflict)[]; done: ShapeFix[]; left: number } {
  const lang = tree.lang;
  const done: ShapeFix[] = [];
  let left = 0;
  const owner = (id: string) => {
    if (records.has(id)) return records.get(id) as Person | Family;
    const was = tree.get<Person | Family>(id);
    return was && !was.retracted ? structuredClone(was) : undefined;
  };
  for (const it of items) {
    if (it.kind === "conflict") {
      const x = (records.get(it.conflict) as Conflict | undefined) ?? structuredClone(tree.get<Conflict>(it.conflict));
      if (!x || (way === "set" ? x.state !== "open" : x.state !== "resolved" || x.decidedAt !== at)) {
        left++;
        continue;
      }
      if (way === "set") {
        x.state = "resolved";
        x.resolution = phrase(lang, "fix.appshape.resolution", { value: it.ours });
        x.reasoning = phrase(lang, "fix.appshape.reasoning", { value: it.theirs });
        x.decidedBy = "user";
        x.decidedAt = at;
        x.taken = "research";
      } else {
        x.state = "open";
        for (const k of ["resolution", "reasoning", "decidedBy", "decidedIn", "decidedAt", "taken"] as const) delete x[k];
      }
      records.set(x.id, x);
      done.push(it);
      continue;
    }
    const o = owner(it.owner);
    const e = o?.events.find((x) => x.id === it.event);
    const b = it.kind === "added" ? o?.events.find((x) => x.id === it.beside) : undefined;
    const ok =
      !!o &&
      !!e &&
      (it.kind === "corrected"
        ? holds(e, way === "set" ? it.after : it.before)
        : way === "set"
          ? !e.retracted && !!b && (it.restore ? !!b.retracted : !b.retracted)
          : e.retracted?.at === at && !!b && !b.retracted);
    if (!ok) {
      left++;
      continue;
    }
    if (it.kind === "corrected") {
      const to = way === "set" ? it.before : it.after;
      if (to.date !== undefined) e!.date = to.date;
      if (to.age !== undefined) e!.age = to.age;
      if (to.ages) e!.ages = { ...e!.ages, ...to.ages };
    } else if (way === "set") {
      e!.retracted = { at, reason: phrase(lang, "fix.appshape.added", { event: it.beside }) };
      e!.status = "retracted";
      // the research's fact as it was before the send withdrew it for the user's word
      if (it.restore) {
        delete b!.retracted;
        b!.status = statusBefore(tree, it);
      }
    } else {
      delete e!.retracted;
      e!.status = (it.status ?? "lead") as Event["status"];
      if (it.restore) {
        b!.retracted = { at: now(), reason: phrase(lang, "fix.appshape.undone") };
        b!.status = "retracted";
      }
    }
    records.set(o!.id, o!);
    done.push(it);
  }
  return { records: [...records.values()], done, left };
}

/** The fix: every item found set right — one operation, what it changed kept for its undo (APP_SHAPES_FILE). Inside withTreeLock. */
export function applyAppShapes(tree: Tree, items: ShapeFix[], version: string, config?: (c: TreeConfig) => void): { changed: number; records: number; left: number } {
  const at = now();
  // the status of each fact withdrawn, for its undo
  const stamped = items.map((it) => (it.kind === "added" ? { ...it, status: tree.get<Person | Family>(it.owner)?.events.find((e) => e.id === it.event)?.status ?? "lead" } : it));
  const { records, done, left } = shape(tree, stamped, "set", at);
  if (!done.length) return { changed: 0, records: 0, left };
  const file = readShapesFile(tree);
  file.runs.push({ at, version, items: done });
  tree.putMany(
    records,
    [{ rel: APP_SHAPES_FILE, content: fileContent(file) }],
    { op: "appshape.fix", targets: records.map((r) => r.id).sort(), summary: `periods and ages of the Strom app no edits: ${done.length} in ${records.length} records (fix app-shapes)` },
    config,
  );
  return { changed: done.length, records: records.length, left };
}

/** What the fix set right and is not undone yet. */
export function appShapesDone(tree: Tree): ShapeFix[] {
  return readShapesFile(tree).runs.flatMap((r) => r.items);
}

/**
 * The fix undone: each conflict open again, each fact withdrawn back (the research's withdrawn again where the send had),
 * each date and age as the sync left it — where still as the fix left it; one changed since is left and counted. One
 * operation; what the fix kept is emptied.
 */
export function undoAppShapes(tree: Tree, config?: (c: TreeConfig) => void): { restored: number; records: number; left: number } {
  const file = readShapesFile(tree);
  if (!file.runs.some((r) => r.items.length)) return { restored: 0, records: 0, left: 0 };
  const records = new Map<string, Person | Family | Conflict>();
  let restored = 0;
  let left = 0;
  // newest run first, each against the records the later ones left
  for (const run of [...file.runs].reverse()) {
    const r = shape(tree, [...run.items].reverse(), "undo", run.at, records);
    restored += r.done.length;
    left += r.left;
  }
  tree.putMany(
    [...records.values()],
    [{ rel: APP_SHAPES_FILE, content: fileContent({ v: 1, runs: [] }) }],
    { op: "appshape.unfix", targets: [...records.keys()].sort(), summary: `periods and ages of the Strom app put back as the syncs left them: ${restored} in ${records.size} records${left ? `, ${left} changed since left` : ""} (fix app-shapes undone)` },
    config,
  );
  return { restored, records: records.size, left };
}
