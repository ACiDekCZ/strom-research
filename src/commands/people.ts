// person add · list · show · edit · name add · retract · restore · family add · show · child · event add · note add · list · edit · retract · restore · cite

import { register, type Input } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, moreLine, paginate, table, truncate } from "../cli/format.ts";
import { suggestionLines, suggestPeople } from "../core/participantlinks.ts";
import { addChild, addEvent, addFamily, addName, addNote, addPerson, citeEvent, citeRecord, editEvent, editFamily, editPerson, findEventOwner, mergeFamilies, notRetracted, mergePersons, parseParticipant, retractEvent, retractPerson } from "../core/actions.ts";
import { listOpt, normId, requireRecord } from "../core/records.ts";
import { SINGLE_KINDS } from "../core/actions.ts";
import { UsageError } from "../core/errors.ts";
import { INFORMATION } from "../core/evidence.ts";
import { EVENT_KINDS, NAME_KINDS, type Citation, type Event, type Family, type Name, type Note, type Person, type Research, type RetractedNote, type Task } from "../core/model.ts";
import {
  ancestorGenerations,
  displayName,
  familiesAsChild,
  familiesAsPartner,
  findPersons,
  formatName,
  gedcomName,
  label,
  lifespan,
  parseName,
  primaryName,
  relationTo,
  resolvePerson,
  sameName,
  titledName,
} from "../core/people.ts";
import { resolveResearch } from "./research.ts";
import { editNote, notesOf, restoreName, restoreNote, retractName, retractNote } from "../core/retractions.ts";
import { DEATH_AFTER_YEARS, unprovenPeople, type UnprovenKind } from "../core/review.ts";
import { foldText } from "../core/text.ts";
import type { Tree } from "../core/tree.ts";
import { isAgent } from "../core/which.ts";
import { UI, ui, type UIKey } from "../cli/ui.ts";
import { eventName, humanDate, humanDay, humanPlace, statusName } from "../cli/human.ts";
import { removedBySync } from "../core/sync.ts";

function list(v: unknown): string[] {
  if (v === undefined) return [];
  return (Array.isArray(v) ? v : [v]).map(String);
}

function resolveAll(tree: Tree, refs: string[]): string[] {
  return refs.map((r) => resolvePerson(tree, r).id);
}

const CITE_OPTIONS = [
  { name: "cite", type: "string" as const, value: "<S…>", description: "the source these facts come from (makes them probable)" },
  { name: "locator", type: "string" as const, value: "<where>", description: "where in the source: folio, entry, line" },
  { name: "quote", type: "string" as const, value: "<text>", description: "the words of the record" },
  { name: "information", type: "string" as const, value: "<kind>", description: "for these facts the source is primary (written at the time by someone who knew), secondary or unknown" },
  { name: "status", type: "string" as const, value: "<status>", description: "lead (default without --cite), possible, probable, proven" },
];

const AGE_OPTION = {
  name: "age",
  type: "string" as const,
  multiple: true,
  value: "<who:age>",
  description: 'age of a partner as the record gives it: "P0001:25", "husband:25 let", "wife:22" (repeatable)',
};

/** "P0001:25", "Anna Svobodová:22", "husband:25" → person ID → age, among the partners of a family. */
function partnerAges(tree: Tree, specs: string[], partners: string[]): Record<string, string> | undefined {
  if (specs.length === 0) return undefined;
  const out: Record<string, string> = {};
  for (const spec of specs) {
    const m = /^(.+?)\s*:\s*(.+)$/.exec(spec.trim());
    if (!m) throw new UsageError(`--age "${spec}": whose age? e.g. --age P0001:25 or husband:25`);
    // "muž", "muz" and "Mann" alike: compared without diacritics
    const who = foldText(m[1]!);
    let id: string | undefined;
    if (["husband", "groom", "man", "muz", "zenich", "father", "otec", "mann", "brautigam", "vater"].includes(who)) id = partners.find((p) => tree.get<Person>(p)?.sex === "M");
    else if (["wife", "bride", "woman", "zena", "nevesta", "mother", "matka", "frau", "braut", "mutter"].includes(who)) id = partners.find((p) => tree.get<Person>(p)?.sex === "F");
    else id = resolvePerson(tree, m[1]!.trim()).id;
    if (!id || !partners.includes(id)) throw new UsageError(`--age "${spec}": not a partner of this family`, { hint: `partners: ${partners.join(", ") || "none"}` });
    out[id] = m[2]!.trim();
  }
  return out;
}

/** A citation from --cite/--locator/--quote, or undefined. */
function citationOf(opts: Input["opts"]): Citation | undefined {
  if ((opts.locator || opts.quote) && !opts.cite) throw new UsageError("--locator/--quote belong to a citation: add --cite <S…>");
  if (!opts.cite) {
    if (opts.information) throw new UsageError("--information belongs to a citation: add --cite <S…>");
    return undefined;
  }
  return {
    source: normId(opts.cite as string, "source"),
    ...(opts.locator ? { locator: String(opts.locator) } : {}),
    ...(opts.quote ? { quote: String(opts.quote) } : {}),
    ...(opts.information ? { information: informationOpt(opts.information) } : {}),
  };
}

function informationOpt(v: unknown): Citation["information"] {
  if (!INFORMATION.includes(v as (typeof INFORMATION)[number])) throw new UsageError(`invalid --information "${String(v)}"`, { hint: INFORMATION.join(", ") });
  return v as Citation["information"];
}

function written(tree: Tree): string {
  return lines(...tree.written.map((o) => o.summary));
}


/**
 * The words of a listing in the research's language where a person reads it at a terminal (found on Mac: "names",
 * "facts", "family" in a Czech research); an agent reads the English it knows, the same lines as ever.
 */
function wordsFor(ctx: Context, tree: Tree) {
  const lang = ctx.io.tty && !isAgent(ctx.env) ? tree.lang : undefined;
  const say = (key: UIKey, english: string, params?: Record<string, string | number>) => (lang ? ui(lang, key, params) : english);
  const word = (kind: string, value: string) => (lang && `ui.show.${kind}.${value}` in UI ? ui(lang, `ui.show.${kind}.${value}` as UIKey) : value);
  return { lang, say, word };
}
type Words = ReturnType<typeof wordsFor>;
const ENGLISH: Words = { lang: undefined, say: (_k, english) => english, word: (_k, v) => v };

/** A relative as a listing names them, marked when they were retracted (removed in the Strom app, a misread person). */
function relative(x: Person, w: Words): string {
  return `${label(x)}${x.retracted ? ` ${w.say("ui.show.removed.mark", "(retracted)")}` : ""}`;
}

/**
 * How a retracted person was taken out, said first: removed in the Strom app — the day, and the sync to undo that puts
 * them back — or retracted another way, the day and why (found: a person the app removed shown as any other).
 */
function removal(tree: Tree, p: Person, w: Words): { line: string; data: { at: string; reason: string; sync?: string; undo?: string } } | undefined {
  if (!p.retracted) return undefined;
  const { at, reason } = p.retracted;
  const day = w.lang ? humanDay(at, w.lang) : at.slice(0, 10);
  const sync = removedBySync(tree, p.id);
  if (sync) {
    const undo = `strom sync undo ${sync.id}`;
    return { line: w.say("ui.show.removed.app", `removed in the Strom app (${day}) — to put back: ${undo}`, { day, undo }), data: { at, reason, sync: sync.id, undo } };
  }
  return { line: w.say("ui.show.removed", `retracted (${day}, ${reason})`, { day, reason }), data: { at, reason } };
}

/** The citations; for a person what a family tree a sync gave cites by the part it came from ("name", "BIRT") said in words. */
function citesOf(citations: Citation[] | undefined, w: Words = ENGLISH): string {
  const where = (l: string) => (!w.lang ? l : `ui.show.loc.${l}` in UI ? w.word("loc", l) : /^[A-Z_]{3,5}$/.test(l) ? eventName(l, w.lang) : l);
  return (citations ?? []).map((c) => c.source + (c.locator ? ` ${where(c.locator)}` : "") + (c.information ? ` (${w.word("info", c.information)})` : "")).join(", ");
}

function nameLine(n: Name, w: Words = ENGLISH): string {
  const cites = citesOf(n.citations, w);
  return `${titledName(n)}${n.kind ? ` (${w.word("name", n.kind)})` : ""}${cites ? `  ← ${cites}` : ""}`;
}

/** What was taken back or corrected on a person and their facts, oldest first: the name or text as it was, when, by whom, why. */
interface HistoryItem {
  kind: "name" | "note" | "edit";
  /** The person or the fact (E…) it was on. */
  on: string;
  text: string;
  /** The kind of a name taken back. */
  nameKind?: string;
  at: string;
  by: string;
  reason: string;
}

function historyOf(p: Person): HistoryItem[] {
  const out: HistoryItem[] = [];
  for (const n of p.retractedNames ?? []) out.push({ kind: "name", on: p.id, text: titledName(n), ...(n.kind ? { nameKind: n.kind } : {}), ...n.retracted });
  const notes = (on: string, list: Note[], gone: RetractedNote[]) => {
    for (const n of [...list, ...gone]) for (const e of n.edits ?? []) out.push({ kind: "edit", on, ...e });
    for (const n of gone) out.push({ kind: "note", on, text: n.text, ...n.retracted });
  };
  notes(p.id, p.notes, p.retractedNotes ?? []);
  for (const e of p.events) {
    for (const x of e.noteEdits ?? []) out.push({ kind: "edit", on: e.id, ...x });
    notes(e.id, [], e.retractedNotes ?? []);
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

function historyLine(h: HistoryItem, w: Words): string {
  const values = { at: h.at.slice(0, 10), by: h.by, reason: h.reason, text: truncate(h.text, 160), name: h.nameKind ? `${h.text} (${w.word("name", h.nameKind)})` : h.text };
  const fact = h.on.startsWith("E") ? `${h.on} ` : "";
  if (h.kind === "name") return w.say("ui.show.history.name", `name ${values.name} retracted ${values.at} (${values.by}): ${values.reason}`, values);
  if (h.kind === "note") return fact + w.say("ui.show.history.note", `note retracted ${values.at} (${values.by}): ${values.reason} — ${values.text}`, values);
  return fact + w.say("ui.show.history.edit", `note corrected ${values.at} (${values.by}): ${values.reason} — before: ${values.text}`, values);
}

export function eventLine(e: Event, w: Words = ENGLISH): string {
  const cites = citesOf(e.citations, w);
  const who = (e.participants ?? []).map((p) => `${w.word("role", p.role)} ${p.person ?? p.name}${p.note ? ` (${p.note})` : ""}`).join(", ");
  const ages = e.ages ? Object.entries(e.ages).map(([p, a]) => `${w.word("who", p)} ${a}`).join(", ") : "";
  return [
    e.id,
    w.lang ? eventName(e.kind, w.lang, e.label) : e.kind,
    w.lang ? "" : (e.label ?? ""),
    w.lang ? humanDate(e.date, w.lang) : (e.date ?? ""),
    w.lang ? humanPlace(e.place, e.house, w.lang) : [e.place, e.house ? `house ${e.house}` : ""].filter(Boolean).join(", "),
    e.value ?? "",
    e.age ? w.say("ui.show.age", `age ${e.age}`, { age: e.age }) : "",
    ages ? w.say("ui.show.ages", `ages ${ages}`, { ages }) : "",
    `[${w.lang ? statusName(e.status, w.lang) : e.status}]`,
    cites ? `← ${cites}` : "",
    who ? w.say("ui.show.with", `with ${who}`, { who }) : "",
    e.retracted ? w.say("ui.show.retracted", `(retracted: ${e.retracted.reason})`, { reason: e.retracted.reason }) : "",
  ]
    .filter(Boolean)
    .join("  ");
}

/** The titles of a name: GEDCOM's NPFX / NSFX, never part of the name itself (not searched or matched by them). */
const TITLE_OPTIONS = [
  { name: "prefix", type: "string" as const, value: "<title>", description: 'title before the name as the record gives it ("Ing.", "Dr.", "Graf")' },
  { name: "suffix", type: "string" as const, value: "<title>", description: 'title or epithet after the name ("ml.", "st.", "Ph.D.")' },
];

register(
  {
    path: ["person", "add"],
    summary: "Add a person (facts without a record are leads)",
    group: "people",
    tree: true,
    writes: true,
    description: "--cite goes to the birth/death given here; without them it cites the name (a record naming a parent or grandparent).",
    args: [{ name: "name", description: 'full name, surname in slashes: "Jan /Novák/"', required: true }],
    options: [
      { name: "sex", type: "string", value: "M|F|U", description: "sex (default U)" },
      { name: "born", type: "string", value: "<date>", description: "birth date (lead)" },
      { name: "born-place", type: "string", value: "<place>", description: "birth place (lead)" },
      { name: "died", type: "string", value: "<date>", description: "death date (lead)" },
      { name: "died-place", type: "string", value: "<place>", description: "death place (lead)" },
      { name: "note", type: "string", value: "<text>", description: "short note" },
      ...TITLE_OPTIONS,
      ...CITE_OPTIONS,
    ],
    examples: [
      'strom person add "Josef /Novák/" --sex M --born "ABT 1870" --note "Father of Jan, miller (family memory)"',
      'strom person add "Jan /Novák/" --sex M --prefix "Ing." --suffix "ml."',
      'strom person add "Jan /Novák/" --sex M --born "24 JUN 1885" --born-place "Kamenice nad Lipou" --cite S0001 --locator "fol. 12, č. 3"',
      'strom person add "Šimon /Ševčík/" --sex M --cite S0002 --locator "fol. 45, č. 12" --information secondary',
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      // Without --born/--died the citation is on the name: the record names this person.
      if (opts.status && !opts.born && !opts["born-place"] && !opts.died && !opts["died-place"])
        throw new UsageError("--status belongs to the birth or death given here (--born/--died)");
      const p = addPerson(tree, {
        name: args[0]!,
        sex: opts.sex as string | undefined,
        born: opts.born as string | undefined,
        bornPlace: opts["born-place"] as string | undefined,
        died: opts.died as string | undefined,
        diedPlace: opts["died-place"] as string | undefined,
        note: opts.note as string | undefined,
        citation: citationOf(opts),
        status: opts.status as string | undefined,
        prefix: opts.prefix as string | undefined,
        suffix: opts.suffix as string | undefined,
      });
      const similar = findPersons(tree, formatName(p.names[0]!)).filter((x) => x.id !== p.id);
      const warn = similar.length ? `note: similar name already in the tree: ${similar.slice(0, 3).map(label).join(" · ")}` : undefined;
      return { text: lines(written(tree), warn), data: { person: p, similar: similar.map((x) => x.id) } };
    },
  },
  {
    path: ["person", "list"],
    summary: "List people (filter by name, research, generation)",
    group: "people",
    tree: true,
    args: [{ name: "filter", description: "part of a name (diacritics optional)" }],
    options: [
      { name: "research", type: "string", value: "<G…>", description: "only people in scope of this research, with generations" },
      { name: "generation", type: "string", value: "<n>", description: "only this generation (with --research)" },
      { name: "unproven", type: "boolean", description: "only people no record of their own proves: how each stands, the records naming them, open tasks" },
      { name: "full", type: "boolean", description: "--json: whole records instead of one row each" },
    ],
    examples: ["strom person list", "strom person list novak", "strom person list --research G0001 --generation 3", "strom person list --unproven"],
    run(ctx: Context, { args, opts }: Input) {
      const tree = ctx.tree();
      let people = tree.list<Person>("person").filter((p) => !p.retracted);
      if (args[0]) people = findPersons(tree, args[0]);
      let gens: Map<string, number> | undefined;
      if (opts.research) {
        const r = resolveResearch(tree, opts.research as string);
        gens = ancestorGenerations(tree, r.focus);
        people = people.filter((p) => gens!.has(p.id));
        if (opts.generation) people = people.filter((p) => gens!.get(p.id) === Number(opts.generation));
        people.sort((a, b) => gens!.get(a.id)! - gens!.get(b.id)! || a.id.localeCompare(b.id));
      }
      if (opts.unproven) return unprovenList(ctx, tree, people, gens);
      const page = paginate(people, ctx.limit, ctx.page);
      const rows = page.items.map((p) => [
        p.id,
        displayName(p),
        lifespan(p),
        gens ? `G${gens.get(p.id)}` : "",
        ui(tree.lang, "ui.person.events", { n: String(p.events.length) }),
        p.events.some((e) => e.status === "proven" || e.status === "probable") ? "" : ui(tree.lang, "ui.person.leadsonly"),
      ]);
      // in the research's language (the person follows it in the agent's session too)
      const filtered = !!args[0] || !!opts.research;
      const text = people.length === 0 ? ui(tree.lang, filtered ? "ui.person.nomatch" : "ui.person.none") : lines(table(rows), moreLine(page, "strom person list", tree.lang));
      return {
        text,
        data: {
          total: page.total,
          page: page.page,
          pages: page.pages,
          persons: page.items.map((p) =>
            opts.full
              ? { ...p, generation: gens?.get(p.id) }
              : { id: p.id, name: displayName(p), lifespan: lifespan(p), sex: p.sex, events: p.events.length, ...(gens ? { generation: gens.get(p.id) } : {}) },
          ),
        },
      };
    },
  },
  {
    path: ["person", "show"],
    summary: "Everything about one person: facts, family, notes",
    group: "people",
    tree: true,
    args: [{ name: "person", description: "ID (P0001) or name", required: true }],
    options: [{ name: "history", type: "boolean", description: "also the names and notes taken back and the texts notes had before they were corrected: when, by whom, why" }],
    examples: ["strom person show P0001", 'strom person show "Antonín Víšek"', "strom person show P0001 --history"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const p = resolvePerson(tree, args[0]!);
      const parents = familiesAsChild(tree, p.id);
      const partnerships = familiesAsPartner(tree, p.id);
      const researches = tree.list<Research>("research").filter((r) => ancestorGenerations(tree, r.focus).has(p.id));
      const w = wordsFor(ctx, tree);
      const unknown = w.say("ui.show.unknown", "(unknown)");
      const removed = removal(tree, p, w);
      const shown = new Set<Person>();
      const who = (x: Person) => (shown.add(x), relative(x, w));
      const out: (string | undefined)[] = [
        ...(removed ? [removed.line, ""] : []),
        `${p.id} ${titledName(primaryName(p))}${lifespan(p) ? ` (${lifespan(p)})` : ""}  ${w.lang ? w.word("sex", p.sex) : `sex ${p.sex}`}`,
        ...(p.names.length > 1 || p.names.some((n) => n.citations?.length) ? ["", w.say("ui.show.names", "names"), ...p.names.map((n) => `  ${nameLine(n, w)}`)] : []),
        "",
        w.say("ui.show.facts", "facts"),
        p.events.length ? table(p.events.map((e) => [`  ${eventLine(e, w)}`])) : `  ${w.say("ui.show.none", "(none)")}`,
        ...p.events.filter((e) => e.note).map((e) => `  ${e.id} ${w.say("ui.show.note", "note")}: ${truncate(e.note!, 160)}`),
        "",
        w.say("ui.show.family", "family"),
      ];
      const parentsWord = w.say("ui.show.parents", "parents");
      for (const f of parents) {
        const link = f.children.find((c) => c.person === p.id)!;
        const names = f.partners.map((id) => {
          const x = tree.get<Person>(id);
          const rel = relationTo(link, id);
          return `${x ? who(x) : id}${rel !== "birth" && link.relations ? ` [${w.word("rel", rel)}]` : ""}`;
        });
        out.push(`  ${parentsWord}  ${f.id}: ${names.join(" & ") || unknown}${link.relation !== "birth" && !link.relations ? ` [${w.word("rel", link.relation)}]` : ""}`);
      }
      if (parents.length === 0) out.push(`  ${parentsWord}  ${unknown}`);
      for (const f of partnerships) {
        const partner = f.partners.filter((id) => id !== p.id).map((id) => tree.get<Person>(id)).filter(Boolean).map((x) => who(x!));
        out.push(`  ${w.say("ui.show.partner", "partner")}  ${f.id}: ${partner.join(", ") || unknown}`);
        for (const e of f.events) out.push(`    ${eventLine(e, w)}`);
        for (const c of f.children) {
          const child = tree.get<Person>(c.person);
          if (child) out.push(`    ${w.say("ui.show.child", "child")}  ${who(child)}${c.relation !== "birth" ? ` [${w.word("rel", c.relation)}]` : ""}`);
        }
      }
      if (researches.length) out.push("", `${w.say("ui.show.research", "in research")}  ${researches.map((r) => `${r.id} ${r.name}`).join(" · ")}`);
      if (p.notes.length) out.push("", w.say("ui.show.notes", "notes"), ...p.notes.map((n) => `  ${n.at.slice(0, 10)} ${n.text}`));
      const history = historyOf(p);
      if (opts.history) out.push("", w.say("ui.show.history", "history"), ...(history.length ? history.map((h) => `  ${historyLine(h, w)}`) : [`  ${w.say("ui.show.history.none", "nothing retracted or corrected")}`]));
      else if (history.length) out.push("", w.say("ui.show.history.more", `retracted or corrected: ${history.length} — strom person show ${p.id} --history`, { n: history.length, id: p.id }));
      return {
        text: lines(...out),
        data: {
          person: p,
          ...(removed ? { removal: removed.data } : {}),
          parentFamilies: parents,
          partnerFamilies: partnerships,
          researches: researches.map((r) => r.id),
          retractedRelatives: [...shown].filter((x) => x.retracted).map((x) => x.id),
          ...(opts.history ? { history } : {}),
        },
      };
    },
  },
  {
    path: ["person", "edit"],
    summary: "Correct a person: sex, the spelling of the name they are shown by, its titles",
    group: "people",
    tree: true,
    writes: true,
    description: "Another name (a birth surname, a married name, another spelling) is added with strom name add, not edited here.",
    args: [{ name: "person", description: "ID (P0001) or name", required: true }],
    options: [
      { name: "sex", type: "string", value: "M|F|U", description: "sex" },
      { name: "name", type: "string", value: "<name>", description: 'the corrected name, surname in slashes: "Jan /Novák/"' },
      ...TITLE_OPTIONS.map((o) => ({ ...o, description: `${o.description}; "" takes it off` })),
    ],
    examples: [
      "strom person edit P0004 --sex M",
      'strom person edit P0001 --name "Antonín /Víšek/" --reason "misread: the register has Víšek"',
      'strom person edit P0003 --prefix "MUDr."',
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const p = editPerson(
        tree,
        resolvePerson(tree, args[0]!).id,
        { sex: opts.sex as string | undefined, name: opts.name as string | undefined, prefix: opts.prefix as string | undefined, suffix: opts.suffix as string | undefined },
        opts.reason as string | undefined,
      );
      return { text: written(tree), data: { person: p } };
    },
  },
  {
    path: ["person", "retract"],
    summary: "Withdraw a person who turned out not to exist (kept, marked retracted) — a duplicate is merged instead",
    group: "people",
    tree: true,
    writes: true,
    args: [{ name: "person", description: "ID or name", required: true }],
    examples: ['strom person retract P0004 --reason "misread: the entry names Anna, not Anton"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const p = retractPerson(tree, resolvePerson(tree, args[0]!).id, opts.reason as string);
      return { text: written(tree), data: { person: p } };
    },
  },
  {
    path: ["person", "merge"],
    summary: "Two records of one person: everything of the second goes to the first",
    group: "people",
    tree: true,
    writes: true,
    description:
      "Names, facts, notes, families and every reference (tasks, hypotheses, godparents …) move to the first; the\n" +
      "second stays, retracted, as \"merged into\". Facts are not merged: two births afterwards are a conflict to\n" +
      "resolve (cite one, retract the other). Different birth parents: merge those families first.",
    args: [
      { name: "keep", description: "the person that stays (ID or name)", required: true },
      { name: "other", description: "the duplicate (ID or name)", required: true },
    ],
    examples: ['strom person merge P0001 P0004 --reason "the same man: born 1811 in Týnec, son of Jakub"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const keep = resolvePerson(tree, args[0]!).id;
      const other = resolvePerson(tree, args[1]!).id;
      const r = mergePersons(tree, keep, other, opts.reason as string);
      const kinds = r.person.events.filter((e) => !e.retracted).map((e) => e.kind);
      const twice = [...new Set(kinds.filter((k, i) => SINGLE_KINDS.has(k) && kinds.indexOf(k) !== i))];
      const warn = twice.length ? `note: ${keep} now has ${twice.join(", ")} twice — keep the better one (strom cite …) and retract the other (strom event retract E… --reason …)` : undefined;
      return { text: lines(written(tree), warn), data: { person: r.person, repointed: r.repointed } };
    },
  },
  {
    path: ["name", "add"],
    summary: "Another name of a person — the birth surname a record gives, a married name, another spelling — with its record",
    group: "people",
    tree: true,
    writes: true,
    description:
      "A name without a surname (\"Markéta\") is completed by the full one and the person is shown by it; the same\n" +
      "name again only adds its citation. A woman is shown by her birth name; --kind married keeps the married one aside.",
    args: [
      { name: "person", description: "ID (P0001) or name", required: true },
      { name: "name", description: 'the name, surname in slashes: "Markéta /Růžičková/"', required: true },
    ],
    options: [
      { name: "kind", type: "string", value: "<kind>", description: `${NAME_KINDS.join(", ")} (default: plain)` },
      { name: "primary", type: "boolean", description: "show the person by this name" },
      ...TITLE_OPTIONS,
      ...CITE_OPTIONS.filter((o) => o.name !== "status"),
    ],
    examples: [
      'strom name add P0002 "Markéta /Růžičková/" --kind birth --cite S0002 --locator "fol. 45, č. 12" --quote "Margaretha, Tochter nach Johann Ružička"',
      'strom name add P0002 "Marie /Nováková/" --kind married',
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const p = resolvePerson(tree, args[0]!);
      const gone = p.retractedNames?.find((n) => sameName(n, parseName(args[1]!)));
      if (gone)
        throw new UsageError(`the name ${gedcomName(gone)} of ${p.id} was retracted: ${gone.retracted.reason}`, {
          hint: `right after all: strom name restore ${p.id} "${gedcomName(gone)}" --reason "…"`,
          code: "name.retracted",
          params: { name: gedcomName(gone), id: p.id, reason: gone.retracted.reason },
        });
      const r = addName(tree, p.id, { name: args[1]!, kind: opts.kind as string | undefined, citation: citationOf(opts), primary: Boolean(opts.primary), prefix: opts.prefix as string | undefined, suffix: opts.suffix as string | undefined });
      return { text: written(tree), data: { person: r.person, name: r.name } };
    },
  },
  {
    path: ["name", "retract"],
    summary: "Take back a name of a person that turned out wrong (kept with the reason, shown nowhere but in the history)",
    group: "people",
    tree: true,
    writes: true,
    description:
      "The name goes from everything that shows, reads or matches names: person show, the brief, the GEDCOM (the Strom\n" +
      "app no longer shows it once it loads the tree), searching and pairing. The name the person is shown by only while\n" +
      "they have another (they are shown by that one then); its spelling is corrected with strom person edit --name.\n" +
      "Seen again: strom person show <who> --history; put back: strom name restore.",
    args: [
      { name: "person", description: "ID (P0001) or name", required: true },
      { name: "name", description: 'the name as the person has it, surname in slashes: "Jana /Nováková/"', required: true },
    ],
    examples: ['strom name retract P0002 "Josef /Nowak/" --reason "misread: the register has Novák"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const r = retractName(tree, resolvePerson(tree, args[0]!).id, args[1]!, opts.reason as string | undefined);
      return { text: written(tree), data: { person: r.person, name: r.name } };
    },
  },
  {
    path: ["name", "restore"],
    summary: "Put a name taken back among the person's names again",
    group: "people",
    tree: true,
    writes: true,
    args: [
      { name: "person", description: "ID (P0001) or name", required: true },
      { name: "name", description: "the retracted name, surname in slashes", required: true },
    ],
    examples: ['strom name restore P0002 "Josef /Nowack/" --reason "the second record gives it too"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const r = restoreName(tree, resolvePerson(tree, args[0]!).id, args[1]!, opts.reason as string | undefined);
      return { text: written(tree), data: { person: r.person, name: r.name } };
    },
  },
  {
    path: ["family", "add"],
    summary: "Add a family: partners and/or children",
    group: "people",
    tree: true,
    writes: true,
    description:
      "--cite goes to the marriage given here; without one it cites the family itself — the record that names\n" +
      "these parents (a grandchild's baptism naming the grandparents). A child's own baptism is cited on its CHR/BIRT.",
    options: [
      { name: "partner", type: "string", multiple: true, value: "<who>", description: "a partner (repeat for two)" },
      { name: "child", type: "string", multiple: true, value: "<who>", description: "a child (repeatable)" },
      { name: "relation", type: "string", value: "<rel>", description: "children's relation: birth (default), adopted, step, foster, unknown" },
      { name: "married", type: "string", value: "<date>", description: "marriage date (lead)" },
      { name: "married-place", type: "string", value: "<place>", description: "marriage place (lead)" },
      { name: "note", type: "string", value: "<text>", description: "short note" },
      AGE_OPTION,
      ...CITE_OPTIONS,
    ],
    examples: [
      "strom family add --partner P0002 --partner P0003 --child P0001",
      'strom family add --partner P0002 --partner P0003 --married "12 FEB 1898" --age husband:28 --age wife:22 --cite S0002',
      'strom family add --partner "Josef Novák" --married "1898"',
      'strom family add --partner P0001 --partner P0002 --married "12 FEB 1910" --married-place "Kamenice nad Lipou" --cite S0001',
      'strom family add --partner P0003 --child P0002 --cite S0002 --locator "fol. 45, č. 12" --information secondary',
    ],
    run(ctx, { opts }) {
      const tree = ctx.tree();
      const partners = resolveAll(tree, list(opts.partner));
      if ((opts.status || listOpt(opts.age).length) && !opts.married && !opts["married-place"])
        throw new UsageError("--status and --age belong to the marriage: give --married <date> (or --married-place)", {
          hint: "without a marriage --cite cites the family itself: the record that names these parents",
        });
      // The same couple twice is almost always a duplicate.
      const existing = partners.length === 2 ? familiesAsPartner(tree, partners[0]!).find((f) => f.partners.includes(partners[1]!)) : undefined;
      const f = addFamily(tree, {
        partners,
        children: resolveAll(tree, list(opts.child)),
        relation: opts.relation as string | undefined,
        married: opts.married as string | undefined,
        marriedPlace: opts["married-place"] as string | undefined,
        note: opts.note as string | undefined,
        citation: citationOf(opts),
        status: opts.status as string | undefined,
        ages: partnerAges(tree, listOpt(opts.age), partners),
      });
      const warn = existing ? `note: ${existing.id} already joins these partners — if it is the same couple, add to it: strom family child ${existing.id} <child> · strom event add ${existing.id} MARR …` : undefined;
      return { text: lines(written(tree), warn), data: { family: f, ...(existing ? { sameCouple: existing.id } : {}) } };
    },
  },
  {
    path: ["family", "show"],
    summary: "One family: partners, facts with their IDs, children",
    group: "people",
    tree: true,
    args: [{ name: "family", description: "family ID (F0001)", required: true }],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const f = requireRecord<Family>(tree, args[0]!, "family");
      const w = wordsFor(ctx, tree);
      const shown = new Set<Person>();
      const who = (x: Person) => (shown.add(x), relative(x, w));
      const partners = f.partners.map((id) => tree.get<Person>(id)).filter(Boolean).map((p) => who(p!));
      const none = `  ${w.say("ui.show.none", "(none)")}`;
      const out = [
        `${f.id} ${partners.join(" & ") || w.say("ui.show.nopartners", "(no partners known)")}`,
        f.citations?.length ? `${w.say("ui.show.evidence", "evidence of the family")}  ← ${citesOf(f.citations, w)}` : undefined,
        "",
        w.say("ui.show.facts", "facts"),
        f.events.length ? table(f.events.map((e) => [`  ${eventLine(e, w)}`])) : none,
        ...f.events.filter((e) => e.note).map((e) => `  ${e.id} ${w.say("ui.show.note", "note")}: ${truncate(e.note!, 160)}`),
        "",
        w.say("ui.show.children", "children"),
        ...(f.children.length
          ? f.children.map((c) => {
              const child = tree.get<Person>(c.person);
              const own = Object.entries(c.relations ?? {}).map(([who, rel]) => w.say("ui.show.relof", `${rel} of ${who}`, { rel: w.word("rel", rel), who }));
              return `  ${child ? who(child) : c.person}${c.relation !== "birth" || own.length ? ` [${[c.relation !== "birth" ? w.word("rel", c.relation) : "", ...own].filter(Boolean).join(", ")}]` : ""}`;
            })
          : [none]),
        ...(f.notes.length ? ["", w.say("ui.show.notes", "notes"), ...f.notes.map((n) => `  ${n.at.slice(0, 10)} ${n.text}`)] : []),
      ];
      return { text: lines(...out), data: { family: f, retractedPeople: [...shown].filter((x) => x.retracted).map((x) => x.id) } };
    },
  },
  {
    path: ["family", "edit"],
    summary: "Change who belongs to a family and how: the partner found later, a stepchild of one parent, a wrong link",
    group: "people",
    tree: true,
    writes: true,
    description:
      "--relation with --parent is the child's relation to that parent only (a stepchild of the husband, the wife's own).\n" +
      "Everything but adding a partner needs --reason.",
    args: [{ name: "family", description: "family ID (F0001)", required: true }],
    options: [
      { name: "partner", type: "string", value: "<who>", description: "add the other partner" },
      { name: "child", type: "string", value: "<who>", description: "the child whose relation changes (with --relation)" },
      { name: "relation", type: "string", value: "<rel>", description: "birth, adopted, step, foster, unknown" },
      { name: "parent", type: "string", value: "<who>", description: "the relation is to this partner only" },
      { name: "remove", type: "string", value: "<who>", description: "take out a person linked by mistake" },
    ],
    examples: [
      "strom family edit F0002 --partner P0003",
      'strom family edit F0002 --child P0006 --relation step --parent P0004 --reason "the baptism names Antonín as stepfather"',
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const who = (v: unknown) => (typeof v === "string" ? resolvePerson(tree, v).id : undefined);
      const f = editFamily(
        tree,
        normId(args[0]!, "family"),
        { partner: who(opts.partner), child: who(opts.child), relation: opts.relation as string | undefined, parent: who(opts.parent), remove: who(opts.remove) },
        opts.reason as string | undefined,
      );
      return { text: written(tree), data: { family: f } };
    },
  },
  {
    path: ["family", "merge"],
    summary: "Two records of one couple: children, facts and citations of the second go to the first",
    group: "people",
    tree: true,
    writes: true,
    args: [
      { name: "keep", description: "the family that stays (F…)", required: true },
      { name: "other", description: "the duplicate (F…)", required: true },
    ],
    examples: ['strom family merge F0001 F0002 --reason "the same couple, recorded twice"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const r = mergeFamilies(tree, normId(args[0]!, "family"), normId(args[1]!, "family"), opts.reason as string);
      return { text: written(tree), data: { family: r.family, repointed: r.repointed } };
    },
  },
  {
    path: ["family", "child"],
    summary: "Add a child to an existing family (with the record naming its parents)",
    group: "people",
    tree: true,
    writes: true,
    args: [
      { name: "family", description: "family ID (F0001)", required: true },
      { name: "child", description: "child (ID or name)", required: true },
    ],
    options: [{ name: "relation", type: "string", value: "<rel>", description: "birth (default), adopted, step, foster, unknown" }, ...CITE_OPTIONS.filter((o) => o.name !== "status")],
    examples: ['strom family child F0001 P0003 --cite S0002 --locator "fol. 45, č. 12"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const f = addChild(tree, normId(args[0]!, "family"), resolvePerson(tree, args[1]!).id, opts.relation as string | undefined, citationOf(opts));
      return { text: written(tree), data: { family: f } };
    },
  },
  {
    path: ["event", "add"],
    summary: "Add a fact (birth, baptism, death, marriage, occupation, ...) to a person or family",
    group: "people",
    tree: true,
    writes: true,
    description: `Kinds: ${Object.keys(EVENT_KINDS).join(" ")} (or words like birth, death, occupation).\nWithout a citation a fact is a lead; proven/probable need a source.`,
    args: [
      { name: "who", description: "person (ID or name) or family ID", required: true },
      { name: "kind", description: "event kind, e.g. BIRT, CHR, DEAT, MARR, OCCU, RESI", required: true },
    ],
    options: [
      { name: "date", type: "string", value: "<date>", description: 'GEDCOM date: "24 JUN 1783", "ABT 1783", "BET 1811 AND 1812"' },
      { name: "place", type: "string", value: "<place>", description: 'the settlement: "Týnec nad Labem" — never with a house number' },
      { name: "house", type: "string", value: "<no.>", description: 'house number or address in the place, as the record gives it: "13"' },
      { name: "cause", type: "string", value: "<text>", description: "cause of death as the record gives it" },
      { name: "value", type: "string", value: "<text>", description: "value of attribute events, e.g. the occupation" },
      { name: "label", type: "string", value: "<text>", description: "what happened (required for EVEN)" },
      { name: "age", type: "string", multiple: true, value: "<age|who:age>", description: 'age as the record gives it: "61", "27 let 3 měsíce"; for a family event per partner: "P0001:25", "wife:22"' },
      { name: "cite", type: "string", value: "<S…>", description: "source proving it (makes it probable by default)" },
      { name: "locator", type: "string", value: "<where>", description: "where in the source: folio, entry, line" },
      { name: "quote", type: "string", value: "<text>", description: "the words of the record" },
      { name: "information", type: "string", value: "<kind>", description: "for this fact the source is primary, secondary or unknown (default: the source's)" },
      { name: "with", type: "string", multiple: true, value: "<role:who>", description: "participant: godparent:Marie Dvořáková, witness:P0012 — roles godparent, witness, officiant, midwife, informant, other; what the record says of them in closing parentheses is the note: \"godparent:Jan Lhoták (sedlák, Lhota č. 12)\" (repeatable)" },
      { name: "status", type: "string", value: "<status>", description: "lead (default without citation), possible, probable, proven (with --information primary: a record of the time read yourself), disproven" },
      { name: "note", type: "string", value: "<text>", description: "short note on this fact" },
    ],
    examples: [
      'strom event add P0001 CHR --date "25 JUN 1905" --place "Týnec nad Labem" --house 12 --cite S0001 --locator "fol. 45, č. 12" --with "godparent:Marie Dvořáková" --information primary --status proven',
      'strom event add P0002 OCCU --value "miller" --status lead',
      'strom event add P0002 EVEN --label "Fire of the farmhouse" --date "NOV 1905"',
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const ref = args[0]!;
      const owner = /^F\d+$/i.test(ref) ? normId(ref) : resolvePerson(tree, ref).id;
      const cited = citationOf(opts);
      const citations = cited ? [cited] : [];
      const ages = listOpt(opts.age);
      let age: string | undefined;
      let partnerAge: Record<string, string> | undefined;
      if (owner.startsWith("F")) partnerAge = partnerAges(tree, ages, tree.get<Family>(owner)?.partners ?? []);
      else if (ages.length > 1) throw new UsageError("one --age for a person's event");
      else age = ages[0];
      const withs = listOpt(opts.with).map((w) => parseParticipant(tree, w));
      const r = addEvent(tree, owner, {
        kind: args[1]!,
        date: opts.date as string | undefined,
        place: opts.place as string | undefined,
        house: opts.house as string | undefined,
        cause: opts.cause as string | undefined,
        value: opts.value as string | undefined,
        label: opts.label as string | undefined,
        age,
        ages: partnerAge,
        participants: withs.length ? withs : undefined,
        citations,
        status: opts.status as string | undefined,
        note: opts.note as string | undefined,
      });
      const warn = r.same
        ? `note: ${r.owner.id} already has ${r.same.kind} ${r.same.id} (${[r.same.date, r.same.place].filter(Boolean).join(", ") || "no date"}, ${r.same.status}). ` +
          `The same fact from another record → strom cite ${r.same.id} <S…> (and retract ${r.event.id}); records that disagree → strom conflict add …`
        : undefined;
      // a participant named only who may be a person of the tree: said, never linked by itself
      const suggest = withs.length ? suggestPeople(tree, r.owner, withs) : [];
      return {
        text: lines(written(tree), warn, ...suggestionLines(r.event.id, suggest, (x) => withs.find((w) => w.role === x.role && w.name === x.name)?.note)),
        data: { event: r.event, owner: r.owner.id, ...(r.same ? { same: r.same.id } : {}), ...(suggest.length ? { suggest } : {}) },
      };
    },
  },
  {
    path: ["note", "add"],
    summary: "Add a short note to a person, family or research",
    group: "people",
    tree: true,
    writes: true,
    args: [
      { name: "id", description: "record ID (P0001, F0001, G0001) or person name", required: true },
      { name: "text", description: "the note (over 500 characters: kept whole as several notes)", required: true },
    ],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const ref = args[0]!;
      const id = /^[A-Z]\d+$/i.test(ref) ? normId(ref) : resolvePerson(tree, ref).id;
      const note = addNote(tree, id, args[1]!, { whole: true });
      return { text: written(tree), data: { id, note } };
    },
  },
  {
    path: ["note", "list"],
    summary: "The notes of a record or a fact, numbered (the number strom note edit and retract take)",
    group: "people",
    tree: true,
    args: [{ name: "id", description: "record ID (P0001, F0001, T0001, S0001 …), a fact (E0001) or person name", required: true }],
    options: [{ name: "history", type: "boolean", description: "also the notes taken back (numbered for strom note restore) and the texts notes had before they were corrected" }],
    examples: ["strom note list P0001", "strom note list T0004 --history"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const id = noteHolderId(tree, args[0]!);
      const { notes, retracted } = notesOf(tree, id);
      const was = (n: Note) => (opts.history ? (n.edits ?? []).map((e) => `     before ${e.at.slice(0, 10)} (${e.by}): ${e.reason} — ${truncate(e.text, 160)}`) : []);
      const out: (string | undefined)[] = [
        notes.length ? `${id} notes` : `${id} has no notes`,
        ...notes.flatMap((n, i) => [`  ${i + 1}  ${[n.at.slice(0, 10), n.by].filter(Boolean).join(" ")}  ${n.text}`, ...was(n)]),
      ];
      if (opts.history && retracted.length)
        out.push("retracted", ...retracted.flatMap((n, i) => [`  ${i + 1}  ${n.at.slice(0, 10)} ${n.by}  ${n.text}`, `     retracted ${n.retracted.at.slice(0, 10)} (${n.retracted.by}): ${n.retracted.reason}`, ...was(n)]));
      else if (retracted.length) out.push(`retracted: ${retracted.length} — strom note list ${id} --history`);
      return {
        text: lines(...out),
        data: { id, notes: notes.map((n, i) => ({ n: i + 1, ...n })), ...(opts.history ? { retracted: retracted.map((n, i) => ({ n: i + 1, ...n })) } : { retracted: retracted.length }) },
      };
    },
  },
  {
    path: ["note", "edit"],
    summary: "Correct a note of a person, family, task or fact — the text it had stays in the history with the reason",
    group: "people",
    tree: true,
    writes: true,
    args: [
      { name: "id", description: "record ID, a fact (E0001) or person name", required: true },
      { name: "n", description: "the note's number (strom note list <id>; a fact's note is 1)", required: true },
      { name: "text", description: "the corrected note", required: true },
    ],
    examples: ['strom note edit T0002 1 "Book 12 searched 1801–1830: no entry" --reason "the years were written wrong"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const id = noteHolderId(tree, args[0]!);
      const note = editNote(tree, id, Number(args[1]), args[2]!, opts.reason as string | undefined);
      return { text: written(tree), data: { id, note } };
    },
  },
  {
    path: ["note", "retract"],
    summary: "Take back a note that turned out wrong (kept with the reason, shown nowhere but in the history)",
    group: "people",
    tree: true,
    writes: true,
    description: "The notes after it move up a number. Seen again: strom note list <id> --history; put back: strom note restore.",
    args: [
      { name: "id", description: "record ID, a fact (E0001) or person name", required: true },
      { name: "n", description: "the note's number (strom note list <id>; a fact's note is 1)", required: true },
    ],
    examples: ['strom note retract P0003 1 --reason "it was about a namesake from No. 37"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const id = noteHolderId(tree, args[0]!);
      const note = retractNote(tree, id, Number(args[1]), opts.reason as string | undefined);
      return { text: written(tree), data: { id, note } };
    },
  },
  {
    path: ["note", "restore"],
    summary: "Put a note taken back among the notes again",
    group: "people",
    tree: true,
    writes: true,
    args: [
      { name: "id", description: "record ID, a fact (E0001) or person name", required: true },
      { name: "n", description: "its number among the retracted (strom note list <id> --history)", required: true },
    ],
    examples: ['strom note restore P0003 1 --reason "it was ours after all"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const id = noteHolderId(tree, args[0]!);
      const note = restoreNote(tree, id, Number(args[1]), opts.reason as string | undefined);
      return { text: written(tree), data: { id, note } };
    },
  },
);

/** The record or fact a note command names: an ID as given, else a person by name. */
function noteHolderId(tree: Tree, ref: string): string {
  return /^[A-Z]\d+$/i.test(ref.trim()) ? normId(ref) : resolvePerson(tree, ref).id;
}

register(
  {
    path: ["cite"],
    summary: "Attach a source to a fact (a lead becomes probable unless --status says otherwise), a person's name or a family",
    group: "people",
    tree: true,
    writes: true,
    description: "A fact (E…) gets the citation and its status; a person (P…) — the name they are shown by; a family (F…) — the family itself.",
    args: [
      { name: "what", description: "event ID (E0001), person (P0001) or family (F0001)", required: true },
      { name: "source", description: "source ID (S0001)", required: true },
    ],
    options: [
      { name: "locator", type: "string", value: "<where>", description: "where in the source: folio, entry, line" },
      { name: "quote", type: "string", value: "<text>", description: "the words of the record" },
      { name: "information", type: "string", value: "<kind>", description: "for this fact the source is primary, secondary or unknown (default: the source's)" },
      { name: "status", type: "string", value: "<status>", description: "of a fact (E…) only: probable (default) or proven — proven only when you read the record yourself" },
    ],
    examples: ['strom cite E0001 S0001 --locator "fol. 45, č. 12" --status proven', 'strom cite F0001 S0001 --locator "fol. 45, č. 12" --information secondary'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const citation: Citation = {
        source: normId(args[1]!, "source"),
        ...(opts.locator ? { locator: String(opts.locator) } : {}),
        ...(opts.quote ? { quote: String(opts.quote) } : {}),
        ...(opts.information ? { information: informationOpt(opts.information) } : {}),
      };
      const id = normId(args[0]!);
      if (/^[PF]\d+$/.test(id)) {
        if (opts.status) throw new UsageError("--status is for facts (E…)", { hint: "a name or a family has no status: its citations say how well it is attested" });
        const rec = citeRecord(tree, id, citation);
        return { text: written(tree), data: { [rec.type]: rec } };
      }
      const e = citeEvent(tree, id, citation, opts.status as string | undefined);
      return { text: written(tree), data: { event: e } };
    },
  },
  {
    path: ["event", "edit"],
    summary: "Change a fact, or add what a record says about it (ages, house, witnesses) — changes need a reason",
    group: "people",
    tree: true,
    writes: true,
    args: [{ name: "event", description: "event ID (E0001)", required: true }],
    options: [
      { name: "date", type: "string", value: "<date>", description: "new date" },
      { name: "place", type: "string", value: "<place>", description: "new place (the settlement)" },
      { name: "house", type: "string", value: "<no.>", description: 'house number in the place ("" removes it)' },
      { name: "cause", type: "string", value: "<text>", description: "cause of death as the record gives it" },
      { name: "value", type: "string", value: "<text>", description: "new value" },
      { name: "label", type: "string", value: "<text>", description: "new label" },
      { name: "age", type: "string", multiple: true, value: "<age|who:age>", description: 'age as the record gives it; a family event per partner: "husband:27", "wife:17"' },
      { name: "with", type: "string", multiple: true, value: "<role:who>", description: "add a participant: witness:Jan Novák, godparent:P0012, officiant:…, midwife:…; a note in closing parentheses: \"witness:Jan Novák (soused)\" (repeatable)" },
      { name: "without", type: "string", multiple: true, value: "<role:who>", description: "take off a participant recorded wrongly — with --reason; a wrong role: --without witness:X --with godparent:X" },
      { name: "status", type: "string", value: "<status>", description: "new status — proven needs a record of the time read yourself: strom cite E… S… --information primary --status proven" },
      { name: "note", type: "string", value: "<text>", description: "replace the note on this fact" },
    ],
    description: "Filling in what was unknown (an age, the house, the witnesses a record names) needs no reason; changing\nwhat was known, or the status, does.",
    examples: [
      'strom event edit E0002 --date "BET 1811 AND 1812" --reason "age 27 at marriage 1839 (S0002)"',
      'strom event edit E0004 --age husband:27 --age wife:22 --house 21 --with "witness:Jan Dvořák" --with "officiant:P. Josef Kříž"',
      'strom event edit E0001 --place "Týnec nad Labem" --house 13 --reason "the house number out of the place"',
      'strom event edit E0001 --without "witness:Marie Dvořáková" --with "godparent:Marie Dvořáková" --reason "the record names her the godmother"',
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const id = normId(args[0]!);
      const { owner } = findEventOwner(tree, id);
      notRetracted(tree, id, "edit");
      const ages = listOpt(opts.age);
      let age: string | undefined;
      let partnerAge: Record<string, string> | undefined;
      if (owner.type === "family") partnerAge = partnerAges(tree, ages, owner.partners);
      else if (ages.length > 1) throw new UsageError("one --age for a person's event");
      else age = ages[0];
      const withs = listOpt(opts.with).map((w) => parseParticipant(tree, w));
      const e = editEvent(
        tree,
        id,
        {
          age,
          ages: partnerAge,
          participants: withs,
          drop: listOpt(opts.without).map((w) => parseParticipant(tree, w, { check: false })),
          date: opts.date as string | undefined,
          place: opts.place as string | undefined,
          house: opts.house as string | undefined,
          cause: opts.cause as string | undefined,
          value: opts.value as string | undefined,
          label: opts.label as string | undefined,
          status: opts.status as string | undefined,
          note: opts.note as string | undefined,
        },
        opts.reason as string | undefined,
      );
      // a participant named only who may be a person of the tree: said, never linked by itself
      const added = withs.filter((w) => (e.participants ?? []).some((p) => p.role === w.role && p.name === w.name));
      const suggest = added.length ? suggestPeople(tree, findEventOwner(tree, id).owner, added) : [];
      return {
        text: lines(written(tree), ...suggestionLines(e.id, suggest, (x) => withs.find((w) => w.role === x.role && w.name === x.name)?.note)),
        data: { event: e, ...(suggest.length ? { suggest } : {}) },
      };
    },
  },
  {
    path: ["event", "retract"],
    summary: "Withdraw a fact that turned out wrong (it is kept, marked retracted)",
    group: "people",
    tree: true,
    writes: true,
    args: [{ name: "event", description: "event ID (E0001)", required: true }],
    examples: ['strom event retract E0003 --reason "namesake: this Jan was born in No. 37, ours in No. 12"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const e = retractEvent(tree, normId(args[0]!), opts.reason as string);
      return { text: written(tree), data: { event: e } };
    },
  },
);

const UNPROVEN_KIND: Record<UnprovenKind, UIKey> = { named: "ui.unproven.kind.named", leads: "ui.unproven.kind.leads", none: "ui.unproven.kind.none" };

/**
 * The people no record of their own proves: how each stands, the records that name them, the tasks already on them —
 * in the research's language where a person runs it (strom check points them here; found on Windows: the list in
 * English in a Czech research), the English an agent knows otherwise.
 */
function unprovenList(ctx: Context, tree: Tree, people: Person[], gens: Map<string, number> | undefined) {
  const person = !isAgent(ctx.env);
  const lang = person ? tree.lang : "en";
  const t = (key: UIKey, values?: Record<string, string | number>) => ui(lang, key, values);
  const among = new Set(people.map((p) => p.id));
  const found = unprovenPeople(tree).filter((u) => among.has(u.person.id));
  // the living come apart: the family's to tell, no research of the registers
  const all = found.filter((u) => !u.living);
  const living = found.filter((u) => u.living);
  const open = tree.list<Task>("task").filter((t) => ["open", "doing", "parked", "waiting"].includes(t.state));
  const tasksOf = (id: string) => open.filter((t) => t.subject.includes(id)).map((t) => t.id);
  const counts = { named: 0, leads: 0, none: 0 };
  for (const u of all) counts[u.kind]++;
  const page = paginate(all, ctx.limit, ctx.page);
  const rows = page.items.map((u) => {
    const tasks = tasksOf(u.person.id);
    return [
      u.person.id,
      displayName(u.person),
      lifespan(u.person),
      gens ? `G${gens.get(u.person.id)}` : "",
      t(UNPROVEN_KIND[u.kind]) + (u.sources.length ? `: ${u.sources.slice(0, 3).join(" ")}${u.sources.length > 3 ? " …" : ""}` : ""),
      u.kind === "none" && !u.person.notes.length ? t("ui.unproven.nonote") : "",
      tasks.length ? t("ui.unproven.list.tasks", { ids: `${tasks.slice(0, 2).join(" ")}${tasks.length > 2 ? " …" : ""}` }) : "",
    ];
  });
  const livingLine = living.length
    ? t("ui.unproven.list.living", { years: DEATH_AFTER_YEARS, names: living.map((u) => `${u.person.id} ${displayName(u.person)}`).join(" · ") })
    : undefined;
  const text = !all.length
    ? lines(t("ui.unproven.list.all"), livingLine)
    : lines(
        t("ui.unproven.list.head", { n: all.length, ...counts }),
        table(rows),
        moreLine(page, "strom person list --unproven", person ? lang : undefined),
        livingLine,
        "",
        t("ui.unproven.list.next"),
      );
  return {
    text,
    data: {
      total: page.total,
      page: page.page,
      pages: page.pages,
      counts,
      living: living.map((u) => u.person.id),
      persons: page.items.map((u) => ({
        id: u.person.id,
        name: displayName(u.person),
        lifespan: lifespan(u.person),
        kind: u.kind,
        sources: u.sources,
        notes: u.person.notes.length,
        tasks: tasksOf(u.person.id),
        ...(gens ? { generation: gens.get(u.person.id) } : {}),
      })),
    },
  };
}
