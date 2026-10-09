// What one commit of a research saved, as a person reads it — in the research
// language, records by their names: "New person: Jan Novák (*1905) [P0001]",
// "Downloaded 7 images: Kniha N 1850 (images 16–22)". Made from the operations
// the commit logged (data/ops/*.jsonl, each line one operation); a commit
// without them (the readers' notes) by its subject. For the Strom app (the
// bridge's /log and change events): strom's own commit subjects are English
// and name records by their IDs.

import type { Op, Tree } from "./tree.ts";
import type { AnyRecord, Conflict, Family, Hypothesis, Input, Lesson, Media, Person, Place, RecordSet, Repository, Research, Search, Session, Source, Task } from "./model.ts";
import { conflictTitle, displayName, lifespan } from "./people.ts";
import { ownerName, cardFact } from "./overview.ts";
import { phrase, type PhraseKey } from "./phrases.ts";
import { eventName, humanDate, humanPlace, humanTask } from "../cli/human.ts";
import { UI, ui, type UIKey } from "../cli/ui.ts";

/** Operations nobody needs to read: what another line says already, or bookkeeping. */
const QUIET = new Set(["session.metrics", "task.start", "task.continue", "session.note"]);

/** The one-line form of an operation, by its kind: {who} a person or family, {name} the record. */
/** What strom mode logs (core/mode.ts), as the history says it. */
const MODE_SAID: Record<string, PhraseKey> = { "the research is an archive": "log.mode.archive", "the research works with an agent again": "log.mode.research" };

const SAID: Record<string, PhraseKey> = {
  "person.add": "log.person.add",
  "person.name": "log.person.name",
  "person.edit": "log.person.edit",
  "person.cite": "log.person.cite",
  "person.retract": "log.person.retract",
  "family.add": "log.family.add",
  "family.edit": "log.family.edit",
  "family.cite": "log.family.cite",
  "source.add": "log.source.add",
  "source.edit": "log.source.edit",
  "recordset.add": "log.recordset.add",
  "recordset.edit": "log.recordset.edit",
  "recordset.calibrate": "log.recordset.calibrate",
  "task.add": "log.task.add",
  "task.done": "log.task.done",
  "task.park": "log.task.park",
  "task.drop": "log.task.drop",
  "task.wait": "log.task.wait",
  "task.wake": "log.task.wake",
  "task.edit": "log.task.edit",
  "session.start": "log.session.start",
  "session.close": "log.session.close",
  "lesson.add": "log.lesson.add",
  "hypothesis.add": "log.hypothesis.add",
  "hypothesis.argue": "log.hypothesis.argue",
  "hypothesis.link": "log.hypothesis.link",
  "hypothesis.variant": "log.hypothesis.variant",
  "hypothesis.decide": "log.hypothesis.decide",
  "conflict.add": "log.conflict.add",
  "conflict.resolve": "log.conflict.resolve",
  "conflict.edit": "log.conflict.edit",
  "place.add": "log.place.add",
  "place.edit": "log.place.edit",
  "place.jurisdiction": "log.place.edit",
  "repository.add": "log.repository.add",
  "repository.edit": "log.repository.edit",
  "story.set": "log.story.set",
  "story.approve": "log.story.approve",
  "story.discard": "log.story.discard",
  "note.add": "log.note.add",
  "note.edit": "log.note.edit",
  "input.add": "log.input.add",
  "input.sync": "log.input.sync",
  "input.done": "log.input.done",
  "input.sync.undo": "log.input.sync.undo",
  "person.restore": "log.person.restore",
  "family.retract": "log.family.retract",
  "source.retract": "log.source.retract",
  "source.sync": "log.source.edit",
  "place.retract": "log.place.retract",
  "repo.retract": "log.repository.retract",
  "name.cite": "log.person.cite",
  "research.add": "log.research.add",
  "research.edit": "log.research.edit",
  "research.pause": "log.research.pause",
  "research.resume": "log.research.resume",
  "research.done": "log.research.done",
};

const EVENT_SAID: Record<string, PhraseKey> = {
  "event.add": "log.event.add",
  "event.edit": "log.event.edit",
  "event.cite": "log.event.cite",
  "event.retract": "log.event.retract",
};

const SEARCH_SAID: Record<string, PhraseKey> = {
  found: "log.search.found",
  negative: "log.search.negative",
  partial: "log.search.partial",
  inconclusive: "log.search.inconclusive",
};

function short(text: string, max = 90): string {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max - 1).trimEnd()}…` : one;
}

/** Image numbers as ranges: 16–22, 30. */
function ranges(ns: number[]): string {
  const sorted = [...new Set(ns)].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j]! + 1) j++;
    out.push(j > i ? `${sorted[i]}–${sorted[j]}` : String(sorted[i]));
    i = j;
  }
  return out.join(", ");
}

/** What a line of the history is about, for the Strom app's filters: people, sources and their images, stories, the rest. */
export type ChangeKind = "person" | "source" | "story" | "other";

function kindOf(op: string): ChangeKind {
  const [record] = op.split(".");
  if (record === "person" || record === "family" || record === "event") return "person";
  if (record === "source" || record === "media" || record === "recordset" || record === "repository") return "source";
  if (record === "story") return "story";
  return "other";
}

/** Lines of what a commit saved, in the research language, each with what it is about; its subject when it logged no operation. */
export function changeLines(tree: Tree, ops: Op[], subject: string, lang: string, was?: Tree): { text: string; kind: ChangeKind }[] {
  const get = <T extends AnyRecord>(id: string | undefined) => (id ? tree.get<T>(id) : undefined);
  const who = (id: string | undefined): string => {
    const r = get<Person | Family>(id);
    if (!r) return id ?? "";
    if (r.type === "person") {
      const span = lifespan(r);
      return `${displayName(r)}${span ? ` (${span})` : ""} [${r.id}]`;
    }
    return (r.type as string) === "family" ? ownerName(tree, r.id) : r.id;
  };
  const task = (id: string | undefined) => {
    const t = get<Task>(id);
    return t ? short(humanTask(tree, t.what, lang)) : (id ?? "");
  };
  const name = (id: string | undefined): string => {
    const r = get<Person | Family | Source | RecordSet | Task | Session | Research | Search | Lesson | Hypothesis | Conflict | Place | Repository | Input>(id);
    if (!r) return id ?? "";
    switch (r.type) {
      case "person":
      case "family":
        return who(r.id);
      case "task":
        return task(r.id);
      case "session":
        return r.task ? task(r.task) : r.id;
      case "conflict":
        return short(conflictTitle(tree, r));
      case "source":
      case "recordset":
        return short(r.title);
      case "research":
      case "repository":
      case "input":
        return short(r.name);
      case "search":
        return short(r.question);
      case "lesson":
        return short(r.rule);
      case "hypothesis":
        return short(r.question);
      case "place":
        return r.names[0]?.name ?? r.id;
      default:
        return (r as { id: string }).id;
    }
  };
  const fact = (owner: string | undefined, eventId: string | undefined, at: Tree = tree): string | undefined => {
    const e = (owner ? at.get<Person | Family>(owner) : undefined)?.events.find((x) => x.id === eventId);
    if (!e) return undefined;
    const f = cardFact(at, e);
    const what = [f.value, humanDate(f.date, lang), humanPlace(f.place, f.house, lang)].filter(Boolean).join(", ");
    return `${eventName(f.kind, lang, f.label)}${what ? `: ${what}` : ""}`;
  };

  const out: { text: string; kind: ChangeKind }[] = [];
  let kind: ChangeKind = "other";
  const say = (line: string) => {
    if (line && !out.some((l) => l.text === line)) out.push({ text: line, kind });
  };
  // Images downloaded: one line for each book, whatever their order.
  const images = new Map<string, number[]>();
  for (const o of ops) {
    if (QUIET.has(o.op)) continue;
    kind = kindOf(o.op);
    const [first, second] = o.targets;
    if (o.op === "media.add") {
      const m = get<Media>(first);
      const key = m?.recordset ?? "";
      if (!images.has(key)) {
        images.set(key, []);
        out.push({ text: `\u0000media:${key}`, kind: "source" }); // its place in the order, filled in below
      }
      if (m?.image !== undefined) images.get(key)!.push(m.image);
      continue;
    }
    // a citation taken off (an undo of a send): said as that, never as "a record for" (found on Mac: "E0013 cites no
    // more S0007: sync I0014 undone" in English to a person)
    if (/^\S+ cites no more /.test(o.summary)) {
      const f = fact(first, second ?? /^(E\d+) /.exec(o.summary)?.[1]);
      say(f ? phrase(lang, "log.event.uncite", { who: who(first), fact: f }) : phrase(lang, o.op === "family.cite" ? "log.family.uncite" : "log.person.uncite", { who: who(first) }));
      continue;
    }
    // a citation put back (an undo of a send that had taken it off): said as that, never as a new record for the fact
    // (found on Mac: "Doklad k údaji: … narození: 1904" before an undo — taken off, or kept?)
    if (o.op === "event.cite" && /^\S+ cites \S+(?:, \S+)* again: /.test(o.summary)) {
      const f = fact(first, second ?? /^(E\d+) /.exec(o.summary)?.[1]);
      if (f) {
        say(phrase(lang, "log.event.recite", { who: who(first), fact: f }));
        continue;
      }
    }
    if (EVENT_SAID[o.op]) {
      // an undo names its fact in what it says, its owner alone in its targets
      const id = second ?? /^(E\d+) /.exec(o.summary)?.[1];
      const f = fact(first, id);
      // what it was before too, where a preview knows it (an undo of a send: "narození: 1871 → 1870")
      const before = was && o.op === "event.edit" ? fact(first, id, was) : undefined;
      say(f ? phrase(lang, EVENT_SAID[o.op]!, { who: who(first), fact: before && before !== f ? `${before} → ${f.replace(/^[^:]*: /, "")}` : f }) : o.summary);
      continue;
    }
    if (o.op === "search.add" || o.op === "search.edit") {
      const s = get<Search>(first);
      say(s ? phrase(lang, SEARCH_SAID[s.result] ?? "log.search.found", { name: short(s.question) }) : o.summary);
      continue;
    }
    if (o.op === "family.child") {
      // a child moved there names the child in what it says, the family alone in its targets
      say(phrase(lang, "log.family.child", { who: who(first), child: who(second ?? /\+child (P\d+)/.exec(o.summary)?.[1]) }));
      continue;
    }
    // what the line is about besides its person, from what the operation says of it: the name, the note, the fact
    if (o.op === "person.name" || o.op === "name.remove") {
      const m = o.op === "person.name" ? /^\S+ name (.+?)(?: \([\w-]+\))?(?: ← \S+)?$/.exec(o.summary) : /^\S+ name (.+?) removed[:,]/.exec(o.summary);
      say(m ? phrase(lang, o.op === "person.name" ? "log.name.add" : "log.name.remove", { name: m[1]!.replace(/\//g, " ").replace(/\s+/g, " ").trim(), who: who(first) }) : o.op === "person.name" ? phrase(lang, "log.person.name", { who: who(first) }) : o.summary);
      continue;
    }
    if (o.op === "note.remove") {
      const m = /^\S+ note "(.*)" removed:/.exec(o.summary);
      say(m ? phrase(lang, "log.note.remove", { note: m[1]!, name: name(first) }) : o.summary);
      continue;
    }
    if (o.op === "event.status" || o.op === "event.restore") {
      const f = fact(first, /^(E\d+)/.exec(o.summary)?.[1]);
      say(f ? phrase(lang, o.op === "event.status" ? "log.event.status" : "log.event.restore", { who: who(first), fact: f }) : o.summary);
      continue;
    }
    if (o.op === "person.merge" || o.op === "family.merge") {
      say(phrase(lang, "log.merge", { who: who(second) }));
      continue;
    }
    // the data brought to a newer schema: said in the research's language (found on Mac: "schema 2: the operations…" in
    // a Czech history), as the person was told when it happened
    if (o.op === "tree.migrate") {
      const step = `ui.migrated.${/^schema (\d+):/.exec(o.summary)?.[1]}` as UIKey;
      say(step in UI ? ui(lang, "ui.migrated", { step: ui(lang, step) }) : o.summary);
      continue;
    }
    // strom mode: said in the research's language (found on Windows: "the research is an archive" in a Czech history)
    if (o.op === "config.set" && MODE_SAID[o.summary]) {
      say(phrase(lang, MODE_SAID[o.summary]!));
      continue;
    }
    // what the Strom app sent: said so, never "material from the family" with the file's name (found on Mac)
    if (o.op === "input.add" || o.op === "input.sync" || o.op === "input.sync.undo") {
      const i = get<Input & { sync?: unknown }>(first);
      if (i?.name?.startsWith("strom-app-")) {
        say(phrase(lang, o.op === "input.sync.undo" ? "log.input.app.undo" : "log.input.app"));
        continue;
      }
      if (i?.sync && o.op === "input.add") {
        say(phrase(lang, "log.input.sync", { name: name(first) }));
        continue;
      }
    }
    const key = SAID[o.op];
    say(key ? phrase(lang, key, { who: who(first), name: name(first) }) : o.summary);
  }
  const lines = out.map(({ text: line, kind }) => {
    if (!line.startsWith("\u0000media:")) return { text: line, kind };
    const book = line.slice("\u0000media:".length);
    const ns = images.get(book) ?? [];
    const title = get<RecordSet>(book)?.title;
    const n = Math.max(ns.length, 1);
    const text = !title
      ? phrase(lang, "log.media.loose", { n })
      : ns.length === 1
        ? phrase(lang, "log.media.one", { name: title, image: ns[0]! })
        : phrase(lang, "log.media", { name: title, n, images: ns.length ? ranges(ns) : "" });
    return { text, kind };
  });
  if (lines.length) return lines;
  // no operations: the readers' notes of a book, else the subject as strom wrote it
  const reading = /^Reading (B\d+)-(\d+)-(\d+): (\d+) images?/.exec(subject);
  if (reading) return [{ text: phrase(lang, "log.reading", { name: get<RecordSet>(reading[1])?.title ?? reading[1]!, n: reading[4]!, images: reading[2] === reading[3] ? reading[2]! : `${reading[2]}–${reading[3]}` }), kind: "source" }];
  return ops.length ? [] : [{ text: subject, kind: "other" }];
}
