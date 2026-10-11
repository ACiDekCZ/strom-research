// search · searched · conflict · hypothesis · lesson · find · gaps

import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { ui, type UIKey } from "../cli/ui.ts";
import { lines, moreLine, paginate, table, truncate } from "../cli/format.ts";
import { UsageError } from "../core/errors.ts";
import {
  LESSON_DETAIL_MAX,
  LESSON_MAX,
  LESSON_SCOPES,
  RECORD_TYPES,
  SEARCH_METHODS,
  SEARCH_RESULTS,
  type AnyRecord,
  type Conflict,
  type Family,
  type Hypothesis,
  type Lesson,
  type Person,
  type RecordSet,
  type RecordType,
  type Research,
  type Search,
  type Source,
  type Task,
  type HypothesisVariant,
  type VariantLink,
  VARIANT_LINK_KINDS,
} from "../core/model.ts";
import { create, csvOpt, listOpt, normId, requireRecord, update } from "../core/records.ts";
import { ancestorGenerations, birthEvent, claimText, conflictTitle, deathEvent, displayName, familiesAsPartner, lifespan, parentsOf, primaryName, resolvePerson, sameFamilyName } from "../core/people.ts";
import { changeLines } from "../core/changelog.ts";
import { isAgent } from "../core/which.ts";
import { foldText, unfoldIndex } from "../core/text.ts";
import { makeNote, makeNotes, splitText } from "../core/actions.ts";
import { takeSide } from "../core/sync.ts";
import { againAllowed, claimOf, isEditConflict, weighedSources } from "../core/conflicts.ts";
import { currentSession } from "../core/session.ts";
import { typeOfId, type Tree } from "../core/tree.ts";
import { resolveResearch } from "./research.ts";
import { childLink, LINK_HOW, linkHints, linkText, personsLink, recordedLinks, recordedText, toLink, writeVariantLink } from "../core/hypolinks.ts";
import { yearsOption, yearsOverlap } from "../core/years.ts";
import { searchedAs } from "../core/evidence.ts";
import { refuseNegativeOverUnclear } from "./readings.ts";

function written(tree: Tree): string {
  return lines(...tree.written.map((o) => o.summary));
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], name: string): T {
  if (!allowed.includes(v as T)) throw new UsageError(`${v === undefined ? "missing" : "invalid"} --${name}${v === undefined ? "" : ` "${String(v)}"`}`, { hint: allowed.join(", ") });
  return v as T;
}

function anyRefs(tree: Tree, refs: string[]): string[] {
  return refs.map((r) => {
    const id = normId(r);
    if (typeOfId(id)) {
      const rec = tree.get(id);
      if (!rec) throw new UsageError(`no record ${id}`);
      if (rec.mergedInto) throw new UsageError(`${id} was merged into ${rec.mergedInto}`, { hint: `use ${rec.mergedInto}`, code: "record.merged", params: { id, into: rec.mergedInto } });
      return id;
    }
    return resolvePerson(tree, r).id;
  });
}

/**
 * Whether a conflict is about a record (strom conflict list --about): named in its subject, a claim's source, the
 * user's edit (its fact, its sources) or the parents it is of — for a person also through their own facts and their
 * families (and those families' facts), for a family through its facts; a hypothesis (no conflict names one) through
 * the people and families it is about and those its variants would connect.
 */
function conflictConcerns(tree: Tree, id: string): (c: Conflict) => boolean {
  const ids = new Set<string>();
  const add = (ref: string) => {
    ids.add(ref);
    const rec = tree.get<AnyRecord>(ref);
    const families: Family[] = rec?.type === "person" ? familiesAsPartner(tree, ref) : rec?.type === "family" ? [rec as Family] : [];
    if (rec?.type === "person") for (const e of (rec as Person).events) ids.add(e.id);
    for (const f of families) {
      ids.add(f.id);
      for (const e of f.events) ids.add(e.id);
    }
  };
  add(id);
  const h = tree.get<AnyRecord>(id);
  if (h?.type === "hypothesis") for (const ref of [...(h as Hypothesis).subject, ...(h as Hypothesis).variants.flatMap((v) => v.linked ?? [])]) add(ref);
  return (c) =>
    c.subject.some((s) => ids.has(s)) ||
    c.claims.some((cl) => cl.source !== undefined && ids.has(cl.source)) ||
    (c.edit !== undefined && (ids.has(c.edit.event) || (c.edit.cites ?? []).some((ci) => ids.has(ci.source)))) ||
    (c.parents !== undefined && [c.parents.child, c.parents.from, c.parents.to ?? "", ...c.parents.partners].some((s) => ids.has(s)));
}

/** The tasks that work on a conflict or hypothesis (--about X…/H…). */
function tasksAbout(tree: Tree, id: string): Task[] {
  return tree.list<Task>("task").filter((t) => t.subject.includes(id));
}

function taskLines(tree: Tree, id: string): string | undefined {
  const tasks = tasksAbout(tree, id);
  return tasks.length ? `tasks  ${tasks.map((t) => `${t.id}${t.state === "open" ? "" : ` [${t.state}]`}`).join(" ")}` : undefined;
}

/** After a conflict or hypothesis is settled: the tasks still open on it. */
/**
 * The sources a hypothesis names (in its question, variants, support, notes, decision) that none of the facts of its
 * people cite — said when it is decided (found live: a fallen soldier's memorial and a casualty list kept in the
 * research's notes while who he was stayed a hypothesis; decided by a marriage entry, his death was never written).
 */
function sourcesNotOnPeople(tree: Tree, h: Hypothesis): { person: string; sources: string[] }[] {
  const text = [h.question, h.decision ?? "", ...h.variants.flatMap((v) => [v.claim, ...v.support, ...v.against]), ...h.notes.map((n) => n.text)].join("\n");
  const named = [...new Set(text.match(/(?<![\p{L}\p{N}])S\d{4,}(?!\p{N})/gu) ?? [])].filter((s) => {
    const src = tree.get<Source>(s);
    return src?.type === "source" && !src.retracted;
  });
  if (!named.length) return [];
  const out: { person: string; sources: string[] }[] = [];
  for (const id of h.subject.filter((x) => x.startsWith("P"))) {
    const p = tree.get<Person>(id);
    if (!p || p.type !== "person" || p.retracted) continue;
    const cited = new Set<string>();
    const add = (cs?: { source: string }[]) => cs?.forEach((c) => cited.add(c.source));
    for (const e of p.events) add(e.citations);
    for (const n of p.names) add(n.citations);
    for (const f of tree.list<Family>("family").filter((f) => !f.retracted && (f.partners.includes(id) || f.children.some((c) => c.person === id)))) {
      add(f.citations);
      for (const e of f.events) add(e.citations);
    }
    const missing = named.filter((s) => !cited.has(s));
    if (missing.length) out.push({ person: id, sources: missing });
  }
  return out;
}

function stillOpen(tree: Tree, id: string): string | undefined {
  const open = tasksAbout(tree, id).filter((t) => !["done", "dropped"].includes(t.state));
  return open.length ? ui(tree.lang, "ui.conflict.tasks-open", { id, tasks: open.map((t) => t.id).join(", "), first: open[0]!.id }) : undefined;
}

// ── what a variant would connect (strom hypothesis link) ───────────────────

/** The next letter of a hypothesis's variants: after the last one used (A, B → C), never one before it. */
function nextLabel(labels: string[]): string {
  const letters = labels.filter((l) => /^[A-Z]$/.test(l)).map((l) => l.charCodeAt(0));
  const next = letters.length ? Math.max(...letters) + 1 : 65;
  if (next <= 90) return String.fromCharCode(next);
  for (let n = labels.length + 1; ; n++) if (!labels.includes(String(n))) return String(n);
}

/** IDs given to a link: repeated, or several in one value (commas or spaces). */
function idsOpt(v: unknown): string[] {
  return listOpt(v).flatMap((x) => x.split(/[\s,]+/)).filter(Boolean);
}

/** The link the options name (undefined: none — --remove alone), checked against the tree. */
function variantLink(tree: Tree, opts: Record<string, unknown>, extra: string[]): VariantLink | undefined {
  const more = extra.flatMap((x) => x.split(/[\s,]+/)).filter(Boolean);
  const kinds = VARIANT_LINK_KINDS.filter((k) => opts[k] !== undefined);
  if (kinds.length > 1) throw new UsageError(`one link at a time: ${kinds.map((k) => `--${k}`).join(", ")} given`, { hint: LINK_HOW });
  const kind = kinds[0];
  if (!kind) {
    if (!opts.remove) throw new UsageError("say what the variant would connect", { hint: LINK_HOW });
    if (more.length || opts.of !== undefined || opts.parents !== undefined) throw new UsageError("--of and --parents go with --child", { hint: LINK_HOW });
    return undefined;
  }
  if (kind === "child") {
    const children = idsOpt(opts.child);
    if (children.length !== 1) throw new UsageError("--child takes one person: the child", { hint: LINK_HOW });
    return childLink(tree, children[0]!, opts.of === undefined ? undefined : String(opts.of), [...idsOpt(opts.parents), ...more]);
  }
  if (opts.of !== undefined || opts.parents !== undefined) throw new UsageError("--of and --parents go with --child", { hint: LINK_HOW });
  return personsLink(tree, kind, [...idsOpt(opts[kind]), ...more]);
}

// ── searches ───────────────────────────────────────────────────────────────

function searchLine(s: Search): string[] {
  return [s.id, searchedAs(s), s.method, truncate(s.question, 60), s.scope.years ?? "", (s.scope.surnames ?? []).join(","), s.recordsets.join(" "), s.by === "main" ? "" : `by ${s.by}`];
}

/** What a found search needs before it: the source it found (N0181, N0187: the search written first). */
const FOUND_FIRST = "the source first, then the search: strom source add \"…\" … — in one batch the source add line first, ending #s, then search add … --found @s";

register(
  {
    path: ["search", "add"],
    summary: "Record a search — ALSO when nothing was found (negative results are results)",
    group: "analysis",
    sheet: "found: the source first (in a batch source add … #s, then --found @s)",
    tree: true,
    writes: true,
    args: [{ name: "question", description: 'what was looked for: "Baptisms Novák 1903–1907"', required: true }],
    options: [
      { name: "recordset", type: "string", multiple: true, value: "<B…>", description: "where (repeatable)", aliases: ["where"] },
      { name: "years", type: "string", value: "<from-to>", description: "years covered" },
      { name: "surname", type: "string", multiple: true, value: "<name>", description: "surnames looked for (repeatable)", aliases: ["surnames"] },
      { name: "place", type: "string", multiple: true, value: "<name>", description: "places covered (repeatable)" },
      { name: "pages", type: "string", value: "<range>", description: "images/pages covered, e.g. 95-100" },
      { name: "method", type: "string", value: "<m>", description: SEARCH_METHODS.join(", ") },
      { name: "result", type: "string", value: "<r>", description: SEARCH_RESULTS.join(", ") },
      { name: "found", type: "string", multiple: true, value: "<S…>", description: "sources found (repeatable; required with --result found)" },
      { name: "task", type: "string", value: "<T…>", description: "task this search served (default: the task of the open session)" },
      { name: "by", type: "string", value: "<who>", description: "main (default), reader, user" },
      { name: "note", type: "string", value: "<text>", description: "what was illegible, what is left" },
    ],
    examples: ['strom search add "Křty Novák 1903–1907" --recordset B0001 --years 1903-1907 --surname Novák --method page-by-page --result negative --task T0001'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const recordsets = csvOpt(opts.recordset).map((b) => requireRecord<RecordSet>(tree, b, "recordset").id);
      const said: string[] = [];
      const years = yearsOption(opts.years, said);
      const findings = csvOpt(opts.found).map((s) => requireRecord(tree, s, "source").id);
      const result = oneOf(opts.result, SEARCH_RESULTS, "result");
      if (result === "found" && findings.length === 0) throw new UsageError("result found needs --found <S…>", { hint: FOUND_FIRST });
      // A search made in a session served that session's task, unless it says otherwise.
      const session = currentSession(tree, ctx.env, ctx.refs);
      const task = opts.task ? requireRecord(tree, String(opts.task), "task").id : session?.task;
      // searched in vain only once what a reader found unclear there was looked at closer
      if (result === "negative") refuseNegativeOverUnclear(tree, { recordsets, pages: opts.pages === undefined ? undefined : String(opts.pages), task }, session);
      const s = create<Search>(
        tree,
        "search",
        {
          question: args[0]!.trim(),
          recordsets,
          scope: {
            ...(years ? { years } : {}),
            ...(csvOpt(opts.surname).length ? { surnames: csvOpt(opts.surname) } : {}),
            ...(listOpt(opts.place).length ? { places: listOpt(opts.place) } : {}),
            ...(opts.pages ? { pages: String(opts.pages) } : {}),
          },
          method: oneOf(opts.method, SEARCH_METHODS, "method"),
          result,
          findings,
          task,
          by: opts.by === undefined ? "main" : oneOf(opts.by, ["main", "reader", "user"] as const, "by"),
          note: opts.note as string | undefined,
        },
        (id) => `+${id} search [${result}] "${truncate(args[0]!, 50)}"`,
        [...recordsets, ...findings],
      );
      return { text: lines(written(tree), ...said), data: { search: s } };
    },
  },
  {
    path: ["search", "list"],
    summary: "Searches done so far (newest first)",
    group: "analysis",
    tree: true,
    options: [{ name: "result", type: "string", value: "<r>", description: "only this result" }, { name: "full", type: "boolean", description: "--json: whole records instead of one row each" }],
    run(ctx, { opts }) {
      const tree = ctx.tree();
      const all = tree
        .list<Search>("search")
        .filter((s) => !opts.result || s.result === opts.result)
        .reverse();
      const page = paginate(all, ctx.limit, ctx.page);
      const rows = opts.full ? page.items : page.items.map((s) => ({ id: s.id, result: s.result, method: s.method, question: s.question, years: s.scope.years, recordsets: s.recordsets }));
      return { text: all.length ? lines(table(page.items.map(searchLine)), moreLine(page, "strom search list")) : "no searches yet", data: { total: page.total, searches: rows } };
    },
  },
  {
    path: ["search", "show"],
    summary: "One search in full",
    group: "analysis",
    tree: true,
    args: [{ name: "search", description: "search ID (Q0001)", required: true }],
    run(ctx, { args }) {
      const s = requireRecord<Search>(ctx.tree(), args[0]!, "search");
      const text = lines(
        `${s.id} ${s.question}`,
        `result ${s.result} · method ${s.method} · by ${s.by}${s.task ? ` · task ${s.task}` : ""}`,
        `where  ${s.recordsets.join(" ") || "(no record set)"}${s.scope.pages ? ` · pages ${s.scope.pages}` : ""}`,
        `scope  ${[s.scope.years, (s.scope.surnames ?? []).join(", "), (s.scope.places ?? []).join(", ")].filter(Boolean).join(" · ") || "(unspecified)"}`,
        s.findings.length ? `found  ${s.findings.join(" ")}` : undefined,
        ...s.notes.map((n) => `note   ${n.text}`),
      );
      return { text, data: { search: s } };
    },
  },
  {
    path: ["search", "edit"],
    summary: "Correct a search: where it looked (record sets, years, pages), what it found, its result",
    group: "analysis",
    tree: true,
    writes: true,
    description:
      "Only the options given change; lists (--recordset, --surname, --place, --found) replace the old ones; --note adds a note.\n" +
      "A search is evidence — a negative one above all: changing where it looked, how, or what came out needs --reason;\n" +
      "filling in what was not recorded doesn't.",
    args: [{ name: "search", description: "search ID (Q0001)", required: true }],
    options: [
      { name: "question", type: "string", value: "<text>", description: "what was looked for" },
      { name: "recordset", type: "string", multiple: true, value: "<B…>", description: "where (repeatable; replaces)", aliases: ["where"] },
      { name: "no-recordset", type: "boolean", description: "it was not in a record set (a catalog, the web): take them off" },
      { name: "years", type: "string", value: "<from-to>", description: "years covered" },
      { name: "surname", type: "string", multiple: true, value: "<name>", description: "surnames looked for (repeatable; replaces)", aliases: ["surnames"] },
      { name: "place", type: "string", multiple: true, value: "<name>", description: "places covered (repeatable; replaces)" },
      { name: "pages", type: "string", value: "<range>", description: "images/pages covered" },
      { name: "method", type: "string", value: "<m>", description: SEARCH_METHODS.join(", ") },
      { name: "result", type: "string", value: "<r>", description: SEARCH_RESULTS.join(", ") },
      { name: "found", type: "string", multiple: true, value: "<S…>", description: "sources found (repeatable; replaces)" },
      { name: "task", type: "string", value: "<T…>", description: "task this search served" },
      { name: "note", type: "string", value: "<text>", description: "add a note" },
    ],
    examples: ['strom search edit Q0001 --recordset B0002 --reason "the index belongs to the other volume"', 'strom search edit Q0001 --pages 95-100 --note "images 101-104 unreadable"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const id = requireRecord<Search>(tree, args[0]!, "search").id;
      if (opts["no-recordset"] && csvOpt(opts.recordset).length) throw new UsageError("--recordset or --no-recordset, not both");
      const said: string[] = [];
      const years = yearsOption(opts.years, said);
      const scope: Search["scope"] = {
        ...(years ? { years } : {}),
        ...(csvOpt(opts.surname).length ? { surnames: csvOpt(opts.surname) } : {}),
        ...(listOpt(opts.place).length ? { places: listOpt(opts.place) } : {}),
        ...(opts.pages ? { pages: String(opts.pages) } : {}),
      };
      const change: Partial<Search> = {
        ...(typeof opts.question === "string" && opts.question.trim() ? { question: opts.question.trim() } : {}),
        ...(csvOpt(opts.recordset).length ? { recordsets: csvOpt(opts.recordset).map((b) => requireRecord<RecordSet>(tree, b, "recordset").id) } : {}),
        ...(opts["no-recordset"] ? { recordsets: [] } : {}),
        ...(opts.method !== undefined ? { method: oneOf(opts.method, SEARCH_METHODS, "method") } : {}),
        ...(opts.result !== undefined ? { result: oneOf(opts.result, SEARCH_RESULTS, "result") } : {}),
        ...(csvOpt(opts.found).length ? { findings: csvOpt(opts.found).map((s) => requireRecord(tree, s, "source").id) } : {}),
        ...(opts.task ? { task: requireRecord(tree, String(opts.task), "task").id } : {}),
      };
      const note = typeof opts.note === "string" && opts.note.trim() ? makeNotes(tree, opts.note) : undefined;
      const fields = [...Object.keys(change), ...Object.keys(scope), ...(note ? ["note"] : [])];
      if (!fields.length) throw new UsageError("nothing to change", { hint: `strom help search edit` });
      const reason = typeof opts.reason === "string" && opts.reason.trim() ? opts.reason.trim() : undefined;
      const s = update<Search>(
        tree,
        id,
        "search",
        (cur) => {
          // What was recorded as searched is evidence: overwriting it needs a reason, filling it in doesn't.
          const was: Record<string, unknown> = { recordsets: cur.recordsets, method: cur.method, result: cur.result, findings: cur.findings, ...cur.scope };
          const now: Record<string, unknown> = { ...change, ...scope };
          const overwritten = ["recordsets", "method", "result", "findings", "years", "surnames", "places", "pages"].filter((k) => {
            const old = was[k];
            const empty = old === undefined || (Array.isArray(old) && old.length === 0);
            return k in now && !empty && JSON.stringify(old) !== JSON.stringify(now[k]);
          });
          if (overwritten.length && !reason)
            throw new UsageError(`changing ${overwritten.join(", ")} of ${id} needs --reason`, { hint: 'a search is evidence: e.g. --reason "the index belongs to the other volume"' });
          const next: Search = { ...cur, ...change, scope: { ...cur.scope, ...scope }, ...(note ? { notes: [...cur.notes, ...note] } : {}) };
          if (next.result === "found" && next.findings.length === 0) throw new UsageError("result found needs --found <S…>", { hint: FOUND_FIRST });
          // made a negative, or its range changed: what a reader found unclear there is looked at closer first
          if (next.result === "negative" && (cur.result !== "negative" || "recordsets" in change || "pages" in scope))
            refuseNegativeOverUnclear(tree, { recordsets: next.recordsets, pages: next.scope.pages, task: next.task }, currentSession(tree, ctx.env, ctx.refs));
          return next;
        },
        { op: "search.edit", summary: `${id} ${fields.join(", ")}`, reason, targets: [...(change.recordsets ?? []), ...(change.findings ?? [])] },
      );
      return { text: lines(written(tree), ...said), data: { search: s } };
    },
  },
  {
    path: ["searched"],
    summary: "Has anyone looked there already? (by record set, person, place or surname)",
    group: "analysis",
    tree: true,
    description: "Check this BEFORE searching: repeating a finished search is the most common waste.",
    args: [{ name: "what", description: "B0001, P0001, a place name or a surname", required: true }],
    options: [{ name: "years", type: "string", value: "<from-to>", description: "only searches overlapping these years" }],
    examples: ["strom searched B0001 --years 1903-1907", "strom searched Novák", "strom searched P0001"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const q = args[0]!.trim();
      const id = normId(q);
      let match: (s: Search) => boolean;
      let what = q;
      if (typeOfId(id) === "recordset") {
        what = requireRecord(tree, id, "recordset").id;
        match = (s) => s.recordsets.includes(id);
      }
      else if (typeOfId(id) === "person") {
        const p = resolvePerson(tree, id);
        const surs = p.names.map((n) => n.surname).filter(Boolean);
        what = `${p.id} ${displayName(p)}`;
        match = (s) => (s.scope.surnames ?? []).some((x) => surs.some((y) => sameFamilyName(x, y))) || (!!s.task && tree.get<{ subject?: string[] } & AnyRecord>(s.task) !== undefined && ((tree.get(s.task) as { subject?: string[] }).subject ?? []).includes(p.id));
      } else {
        const key = foldText(q);
        match = (s) =>
          (s.scope.surnames ?? []).some((x) => foldText(x) === key || sameFamilyName(x, q)) ||
          (s.scope.places ?? []).some((x) => foldText(x).includes(key)) ||
          foldText(s.question).includes(key) ||
          s.recordsets.some((b) => {
            const r = tree.get<RecordSet>(b);
            return !!r && (foldText(r.title).includes(key) || r.places.some((pl) => foldText(pl).includes(key)));
          });
      }
      const said: string[] = [];
      const years = yearsOption(opts.years, said);
      const hits = tree.list<Search>("search").filter((s) => match(s) && yearsOverlap(s.scope.years, years));
      const negative = hits.filter((s) => s.result === "negative").length;
      // a negative of an index is the index's: the book itself not searched in vain by it
      const ofIndex = hits.filter((s) => s.result === "negative" && s.method === "index").length;
      const text = hits.length
        ? lines(`${hits.length} search(es) for ${what}${years ? ` in ${years}` : ""} — ${negative} negative${ofIndex ? ` (${ofIndex} in an index only — not the book searched in vain)` : ""}, ${hits.length - negative} with results`, table(hits.map(searchLine)))
        : `nothing searched yet for ${what}${years ? ` in ${years}` : ""}`;
      return { text: lines(text, ...said), data: { searches: hits } };
    },
  },
);

// ── conflicts and hypotheses ───────────────────────────────────────────────

/** "A: claim", "B : claim", "3: claim" — one letter or a number before the colon; "Jan: …" is a claim, not a letter. */
const VARIANT_LABEL = /^(\p{L}|\p{N}{1,2})\s*:\s*(.+)$/su;

register(
  {
    path: ["conflict", "add"],
    summary: "Record that sources disagree (never silently pick one)",
    group: "analysis",
    tree: true,
    writes: true,
    args: [{ name: "title", description: 'e.g. "Birth year of Antonín: 1811 or 1813?"', required: true }],
    options: [
      { name: "about", type: "string", multiple: true, value: "<who>", description: "person/record concerned (repeatable)" },
      { name: "claim", type: "string", multiple: true, value: "<S…: value>", description: 'a claim, e.g. "S0027: aged 27 at marriage 1839" (repeat for each)' },
      { name: "fact", type: "string", value: "<TAG>", description: "the fact it is about, by its GEDCOM tag: BIRT, DEAT, BAPM, BURI, MARR, NAME, SEX… (the Strom app shows it there)" },
      { name: "note", type: "string", value: "<text>", description: "short note" },
    ],
    examples: ['strom conflict add "Rok narození Josefa" --about P0002 --fact BIRT --claim "S0001: 27 let při sňatku 1839" --claim "S0002: 70 let při úmrtí 1883"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const claims = listOpt(opts.claim).map((c) => {
        const m = /^([Ss]\d+)\s*:\s*(.+)$/.exec(c);
        if (m) return { source: requireRecord(tree, m[1]!, "source").id, value: m[2]!.trim() };
        return { value: c.trim() };
      });
      if (claims.length < 2) throw new UsageError("a conflict needs at least two --claim", { hint: '--claim "S0027: 27 years" --claim "S0031: 70 years"' });
      const subject = anyRefs(tree, listOpt(opts.about));
      if (!subject.length) throw new UsageError("--about is required");
      const fact = typeof opts.fact === "string" ? opts.fact.trim().toUpperCase() : undefined;
      if (fact !== undefined && !/^(?:[A-Z]{3,4}|_[A-Z]{2,6})$/.test(fact)) throw new UsageError(`--fact is a GEDCOM tag (BIRT, DEAT, NAME, SEX…), not "${opts.fact}"`);
      // the user decided this fact (in the Strom app, at a terminal): an agent opens it again only on a source that
      // decision did not weigh, with a reason — never because it reads the same record again
      if (fact && tree.actor !== "user") {
        const reason = typeof opts.reason === "string" && opts.reason.trim() ? opts.reason.trim() : undefined;
        for (const d of tree.list<Conflict>("conflict").filter((c) => c.state === "resolved" && c.decidedBy === "user" && c.fact === fact && c.subject.some((s) => subject.includes(s)))) {
          const weighed = weighedSources(tree, d);
          const fresh = claims.map((c) => c.source).filter((s): s is string => !!s && !weighed.has(s));
          if (!fresh.length || !reason)
            throw new UsageError(`the user decided ${fact} of ${d.subject.join(", ")} in ${d.id}: "${truncate(d.resolution ?? "", 80)}" — an agent opens it again only on a source that decision did not weigh, with --reason`, {
              hint: `strom conflict show ${d.id}; a new record: strom conflict add … --claim "S…: …" --reason "<what it shows>" — or ask the user`,
              code: "conflict.user-decided",
              params: { id: d.id, resolution: d.resolution ?? "" },
            });
        }
      }
      const x = create<Conflict>(tree, "conflict", { title: args[0]!.trim(), ...(fact ? { fact } : {}), subject, claims, state: "open", note: opts.note as string | undefined }, (id) => `+${id} conflict "${truncate(args[0]!, 60)}"`, subject);
      return { text: written(tree), data: { conflict: x } };
    },
  },
  {
    path: ["conflict", "resolve"],
    summary: "Resolve a conflict with the reasoning",
    group: "analysis",
    tree: true,
    writes: true,
    description:
      "A decided conflict is decided again only with --reason (the earlier decision is kept in a note). One the user decided " +
      "(in the Strom app, or at a terminal) stands: an agent decides it again only on a source the decision did not weigh " +
      "(--source S…) and with --reason; a side once taken is not taken again — change the facts with the fact commands.",
    args: [{ name: "conflict", description: "conflict ID (X0001)", required: true }],
    options: [
      { name: "resolution", type: "string", value: "<text>", description: "the conclusion (with --take: the value taken, by default)" },
      { name: "reasoning", type: "string", value: "<text>", description: "why — which evidence outweighs which" },
      { name: "take", type: "string", value: "<user|research>", description: "a conflict of the user's edit in the Strom app: whose value the fact keeps — the user's is written into it" },
      { name: "source", type: "string", multiple: true, value: "<S…>", description: "deciding again what the user decided: the new source it rests on (one none of its claims names)" },
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const id = normId(args[0]!, "conflict");
      const c0 = requireRecord<Conflict>(tree, id, "conflict");
      const take = opts.take === undefined ? undefined : String(opts.take).toLowerCase();
      if (take !== undefined && take !== "user" && take !== "research") throw new UsageError(`--take is user or research, not "${opts.take}"`, { code: "conflict.take", params: { take: String(opts.take) } });
      // a conflict of the user's edit in the Strom app: a fact's, a child's parents, a name's or a sex's
      const ofEdit = isEditConflict(c0);
      if (take && !ofEdit) throw new UsageError(`${id} is no conflict of an edit in the Strom app: write what you conclude with the commands that change facts, then resolve it with --resolution`, { hint: `strom conflict show ${id}`, code: "conflict.no-edit", params: { id } });
      // the conclusion naming one side's value exactly: that side taken (found on Mac: "tesař" resolved, the fact left
      // "kovář", the app then showing kovář in silence)
      const user = claimOf(c0, "user");
      const research = claimOf(c0, "research");
      // …with the source it rests on after it, as the decide link of the Strom app writes it: "4 MAR 1885 (S0004)"
      // (found: the user's value picked there closed the conflict and wrote nothing)
      const said = opts.resolution ? foldText(String(opts.resolution).replace(/\s*\((?:[Ss]\d+(?:\s*,\s*[Ss]\d+)*)\)\s*$/u, "")).trim() : undefined;
      // (as strom compares it, or in words as the person reads it)
      const names = (c: typeof user) => (c ? [c.value, claimText(tree, c0, c)].map((v) => foldText(v).trim()) : []);
      const side = (take as "user" | "research" | undefined) ?? (ofEdit && said ? (names(user).includes(said) ? "user" : names(research).includes(said) ? "research" : undefined) : undefined);
      // the decision the Strom app shows: the side's value in the research's language
      const resolution = opts.resolution ? String(opts.resolution) : side === "user" && user ? claimText(tree, c0, user) : side === "research" && research ? claimText(tree, c0, research) : undefined;
      // what is missing, said exactly (found on Mac: "--resolution and --reasoning" where --take gave the one)
      if (!resolution && !opts.reasoning)
        throw new UsageError("--resolution and --reasoning are required", ofEdit ? { hint: `or take a side: strom conflict resolve ${id} --take user|research --reasoning "<why>"`, code: "conflict.needs-side", params: { id } } : { code: "conflict.needs" });
      if (!opts.reasoning) throw new UsageError("--reasoning is required", { hint: `strom conflict resolve ${id} … --reasoning "<why>"`, code: "conflict.needs-reasoning", params: { id } });
      if (!resolution) throw new UsageError("--resolution is required", { ...(ofEdit ? { hint: `or take a side: strom conflict resolve ${id} --take user|research` } : {}), code: "conflict.needs-resolution", params: { id } });
      const reason = typeof opts.reason === "string" && opts.reason.trim() ? opts.reason.trim() : undefined;
      const sources = listOpt(opts.source).map((s) => requireRecord(tree, s, "source").id);
      // who decides: the user (in the Strom app through the bridge, or at a terminal), else an agent
      const by: "user" | "agent" = tree.actor === "user" ? "user" : "agent";
      const inApp = ctx.env.STROM_FOR_APP === "1";
      let did: string | undefined;
      let again: Conflict | undefined;
      const x = tree.withTreeLock(() => {
        // read afresh under the lock: decided meanwhile (another strom, the app) — never decided over in silence
        const now = tree.get<Conflict>(id)!;
        if (now.state === "resolved") {
          againAllowed(tree, now, { reason, sources, by, side });
          again = now;
        }
        if (side) did = takeSide(tree, now, side, String(opts.reasoning));
        const earlier = again ? [makeNote(tree, truncate(`earlier decided${again.decidedBy ? ` by the ${again.decidedBy}` : ""}${again.taken ? ` (the ${again.taken === "user" ? "user's" : "research's"} value)` : ""}: ${again.resolution ?? ""} — ${again.reasoning ?? ""}`, 480))] : [];
        const newer = again && sources.length ? [makeNote(tree, truncate(`decided again on ${sources.join(", ")}: ${reason}`, 480))] : [];
        return update<Conflict>(
          tree,
          id,
          "conflict",
          (c) => {
            const { taken: _t, decidedIn: _i, ...rest } = c;
            return { ...rest, state: "resolved", resolution, reasoning: String(opts.reasoning), decidedBy: by, ...(inApp ? { decidedIn: "app" as const } : {}), decidedAt: new Date().toISOString(), ...(side ? { taken: side } : {}), notes: [...c.notes, ...earlier, ...newer] };
          },
          {
            op: "conflict.resolve",
            summary: `${id} ${again ? "decided again" : "resolved"}${side ? ` — the ${side === "user" ? "user's edit" : "research's"} taken` : ""}${inApp ? " in the Strom app" : ""}`,
            ...(reason ? { reason } : {}),
          },
        );
      });
      // what was saved, in the research's language — the user's decision, whoever typed it (found on Mac: "X0001
      // resolved — the user's edit taken" in a Czech research, through an agent); a conclusion of neither side leaves
      // the fact as it was — said, with how to take the user's
      const shown = lines(...changeLines(tree, tree.written, "", tree.lang).map((l) => l.text));
      const left = c0.edit && !side ? ui(tree.lang, "ui.conflict.left", { fact: c0.edit.event, value: research ? claimText(tree, c0, research) : "?", id }) : undefined;
      return { text: lines(shown, left, stillOpen(tree, id)), data: { conflict: x, ...(side ? { taken: side } : {}), ...(did ? { written: did } : {}) } };
    },
  },
  {
    path: ["conflict", "list"],
    summary: "Conflicts between sources",
    group: "analysis",
    tree: true,
    description:
      "--about: only the conflicts about one person, hypothesis or source (also a family F… or a fact E…) — a person's\n" +
      "own facts and families count, a source counts where a claim or the user's edit cites it, a hypothesis through\n" +
      "the people and families it is about or its variants would connect.",
    options: [
      { name: "all", type: "boolean", description: "include resolved" },
      { name: "about", type: "string", value: "<P…|H…|S…>", description: "only the conflicts about this person, hypothesis or source (also F…, E…)" },
    ],
    examples: ["strom conflict list", "strom conflict list --about P0001", "strom conflict list --about S0002 --all --json"],
    run(ctx, { opts }) {
      const tree = ctx.tree();
      const about = typeof opts.about === "string" ? anyRefs(tree, [opts.about])[0]! : undefined;
      const concerns = about ? conflictConcerns(tree, about) : undefined;
      const all = tree.list<Conflict>("conflict").filter((c) => (opts.all || c.state === "open") && (!concerns || concerns(c)));
      return {
        text: all.length ? table(all.map((c) => [c.id, ui(tree.lang, c.state === "resolved" ? "ui.conflict.state.resolved" : "ui.conflict.state.open"), truncate(conflictTitle(tree, c), 60), c.subject.join(" ")])) : ui(tree.lang, opts.all ? "ui.conflict.none.all" : "ui.conflict.none"),
        data: { ...(about ? { about } : {}), conflicts: all },
      };
    },
  },
  {
    path: ["conflict", "show"],
    summary: "One conflict with its claims",
    group: "analysis",
    tree: true,
    args: [{ name: "conflict", description: "conflict ID", required: true }],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const c = requireRecord<Conflict>(tree, args[0]!, "conflict");
      // the person reads it in the research's language (found on Mac: "about", "claim" in a Czech research)
      const t = (k: UIKey) => ui(tree.lang, k);
      // a sex in words, as its title says it (found on Mac: "U", "F" under "Pohlaví — neznámé × žena")
      const value = (v: string) => (c.fact === "SEX" && /^[MFU]$/.test(v) ? t(v === "U" ? "ui.conflict.sex.U" : (`ui.show.sex.${v}` as UIKey)) : v);
      return {
        text: lines(
          `${c.id} ${conflictTitle(tree, c)}  [${t(c.state === "resolved" ? "ui.conflict.state.resolved" : "ui.conflict.state.open")}]`,
          `${t("ui.conflict.about")}  ${c.subject.join(" ")}`,
          taskLines(tree, c.id),
          ...c.claims.map((cl) => `${t("ui.conflict.claim")}  ${cl.source ? `${cl.source}: ` : ""}${value(claimText(tree, c, cl))}`),
          c.resolution ? `\n${t("ui.conflict.resolution")}  ${c.resolution}\n${t("ui.conflict.reasoning")}  ${c.reasoning ?? ""}` : undefined,
          ...c.notes.map((n) => `${t("ui.conflict.note")}  ${n.text}`),
        ),
        data: { conflict: c },
      };
    },
  },
  {
    path: ["hypothesis", "add"],
    summary: "Record competing explanations (A/B/C) with support and objections",
    group: "analysis",
    tree: true,
    writes: true,
    args: [{ name: "question", description: 'e.g. "Who was the father of Marie?"', required: true }],
    options: [
      { name: "about", type: "string", multiple: true, value: "<who>", description: "person/record concerned (repeatable)" },
      { name: "variant", type: "string", multiple: true, value: "<A: claim>", description: 'a variant, e.g. "A: Josef from No. 12" (repeat)' },
      { name: "note", type: "string", value: "<text>", description: "short note" },
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      // the letters given first; a variant without one gets the next free letter — never one twice
      const given = listOpt(opts.variant).map((v) => ({ m: VARIANT_LABEL.exec(v.trim()), v }));
      const used = given.flatMap(({ m }) => (m ? [m[1]!.toUpperCase()] : []));
      const twice = used.find((l, i) => used.indexOf(l) !== i);
      if (twice) throw new UsageError(`variant ${twice} given twice: a letter is one variant's`, { hint: 'leave the letters out and strom gives them: --variant "<claim>" --variant "<claim>"' });
      const variants = given.map(({ m, v }) => {
        const label = m ? m[1]!.toUpperCase() : nextLabel(used);
        if (!m) used.push(label);
        return { label, claim: (m ? m[2]! : v).trim(), support: [], against: [] };
      });
      if (variants.length < 2) throw new UsageError("a hypothesis needs at least two --variant");
      const subject = anyRefs(tree, listOpt(opts.about));
      if (!subject.length) throw new UsageError("--about is required");
      const h = create<Hypothesis>(tree, "hypothesis", { question: args[0]!.trim(), subject, variants, state: "open", note: opts.note as string | undefined }, (id) => `+${id} hypothesis "${truncate(args[0]!, 60)}"`, subject);
      // a variant that names people by ID: what it would connect, said so the Strom app shows it
      const hints = linkHints(tree, h, h.variants.map((v) => v.label));
      return { text: lines(written(tree), ...hints), data: { hypothesis: h, ...(hints.length ? { linkHints: hints } : {}) } };
    },
  },
  {
    path: ["hypothesis", "argue"],
    summary: "Add support for or an objection to one variant",
    group: "analysis",
    tree: true,
    writes: true,
    args: [
      { name: "hypothesis", description: "hypothesis ID (H0001)", required: true },
      { name: "variant", description: "variant label, e.g. A", required: true },
    ],
    options: [
      { name: "for", type: "string", value: "<text>", description: "supporting evidence (cite S… inside)" },
      { name: "against", type: "string", value: "<text>", description: "objection" },
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      if (!opts.for && !opts.against) throw new UsageError("give --for or --against");
      const id = normId(args[0]!, "hypothesis");
      const h = update<Hypothesis>(tree, id, "hypothesis", (h) => {
        const v = h.variants.find((x) => foldText(x.label) === foldText(args[1]!));
        if (!v) throw new UsageError(`no variant ${args[1]} in ${id}`, { hint: h.variants.map((x) => x.label).join(", ") });
        if (opts.for) v.support.push(String(opts.for));
        if (opts.against) v.against.push(String(opts.against));
        return h;
      }, { op: "hypothesis.argue", summary: `${id} ${args[1]} ${opts.for ? "+for" : "+against"}` });
      return { text: written(tree), data: { hypothesis: h } };
    },
  },
  {
    path: ["hypothesis", "variant"],
    summary: "Add a variant to an open hypothesis — a new letter, never one used before",
    group: "analysis",
    tree: true,
    writes: true,
    description: "A variant's letter stays one claim's (the Strom app remembers it): a claim that changes whom it would connect is a new variant.",
    args: [
      { name: "hypothesis", description: "hypothesis ID (H0001)", required: true },
      { name: "claim", description: 'the claim, e.g. "the son of Josef from No. 12" (or "C: …" with its letter)', required: true },
    ],
    examples: ['strom hypothesis variant H0001 "syn Josefa z čp. 12"'],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const id = normId(args[0]!, "hypothesis");
      const m = VARIANT_LABEL.exec(args[1]!.trim());
      const claim = (m ? m[2]! : args[1]!).trim();
      if (!claim) throw new UsageError("the claim is empty");
      // (a writing command holds the tree's lock from its first read: the letter picked here is the one written)
      const now = requireRecord<Hypothesis>(tree, id, "hypothesis");
      if (now.state !== "open") throw new UsageError(`${id} is ${now.state}: a variant is added to an open hypothesis`, { hint: `strom hypothesis show ${id}` });
      if (m && now.variants.some((v) => foldText(v.label) === foldText(m[1]!)))
        throw new UsageError(`${id} has a variant ${m[1]} already: a letter is never used twice`, { hint: "leave the letter out: strom picks the next one" });
      const label = m ? m[1]!.toUpperCase() : nextLabel(now.variants.map((v) => v.label));
      const h = update<Hypothesis>(tree, id, "hypothesis", (h) => ({ ...h, variants: [...h.variants, { label, claim, support: [], against: [] }] }), {
        op: "hypothesis.variant",
        summary: `${id} +${label}: ${truncate(claim, 60)}`,
      });
      const hints = linkHints(tree, h, [label]);
      return { text: lines(written(tree), ...hints), data: { hypothesis: h, variant: label, ...(hints.length ? { linkHints: hints } : {}) } };
    },
  },
  {
    path: ["hypothesis", "link"],
    summary: "Say what a variant would connect — whose child, the same person, a couple, siblings — never a link of the tree",
    group: "analysis",
    tree: true,
    writes: true,
    description: [
      "A variant about a connection names its people by ID: the Strom app shows what it would connect (drawn apart, only",
      "for a look) and where the tree ends, the parents named but not linked. Nothing is linked in the tree until the",
      "hypothesis is decided and the link recorded (family add / family child). One link per call; a variant may have several.",
      "  --child P… --of F…           the child of a family of the tree",
      "  --child P… --parents P… [P…]  the child of one or two parents who have no family together",
      "  --same P… P…                 two records of one person",
      "  --partners P… P…             a couple",
      "  --siblings P… P… [P…]        siblings, their parents unknown",
      "--remove takes that link off again; --remove alone, every link of the variant.",
      "A variant's letter stays its claim's (the Strom app remembers it): links may be added to it, never links naming",
      "other people once it had some — that is a new variant (strom hypothesis variant). Deciding: decide --variant <label>.",
    ].join("\n"),
    args: [
      { name: "hypothesis", description: "hypothesis ID (H0001)", required: true },
      { name: "variant", description: "variant label, e.g. B", required: true },
      { name: "people", description: "the second (and further) person of --same, --partners, --siblings or --parents", variadic: true },
    ],
    options: [
      { name: "child", type: "string", value: "<P…>", description: "the child whose parents the variant names" },
      { name: "of", type: "string", value: "<F…>", description: "…the family of the tree it would be a child of" },
      { name: "parents", type: "string", multiple: true, value: "<P…>", description: "…or its one or two parents (no family of theirs)" },
      { name: "same", type: "string", multiple: true, value: "<P…>", description: "two records of one person" },
      { name: "partners", type: "string", multiple: true, value: "<P…>", description: "a couple" },
      { name: "siblings", type: "string", multiple: true, value: "<P…>", description: "two or more siblings" },
      { name: "remove", type: "boolean", description: "take the link off (alone: every link of the variant)" },
    ],
    examples: [
      "strom hypothesis link H0001 B --child P0006 --of F0001",
      "strom hypothesis link H0001 B --child P0006 --parents P0002 P0003",
      "strom hypothesis link H0001 B --same P0005 P0003",
      "strom hypothesis link H0001 A --remove",
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const id = normId(args[0]!, "hypothesis");
      const link = variantLink(tree, opts, args.slice(2));
      const h = writeVariantLink(tree, id, args[1]!, link, { remove: !!opts.remove });
      const v = h.variants.find((x) => foldText(x.label) === foldText(args[1]!))!;
      return {
        text: lines(written(tree), ...(v.links ?? []).map((l) => `  ${v.label} ⇢ ${linkText(l)}`)),
        data: { hypothesis: h, variant: v.label, links: v.links ?? [] },
      };
    },
  },
  {
    path: ["hypothesis", "decide"],
    summary: "Decide a hypothesis (or abandon it) — again, with a reason, when a new record overturns the decision",
    group: "analysis",
    tree: true,
    writes: true,
    description: "Deciding again keeps the earlier decision in a note; it needs --reason.",
    args: [{ name: "hypothesis", description: "hypothesis ID", required: true }],
    options: [
      { name: "decision", type: "string", value: "<text>", description: "which variant and why" },
      { name: "variant", type: "string", value: "<label>", description: "the variant it is decided for (always when its variants have links)" },
      { name: "abandon", type: "boolean", description: "none of the variants can be decided" },
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      if (!opts.decision) throw new UsageError("--decision is required");
      const id = normId(args[0]!, "hypothesis");
      const reason = typeof opts.reason === "string" && opts.reason.trim() ? opts.reason.trim() : undefined;
      if (opts.variant !== undefined && opts.abandon) throw new UsageError("--variant names the variant it is decided for: not with --abandon");
      const h = update<Hypothesis>(
        tree,
        id,
        "hypothesis",
        (h) => {
          // A decision is overturned in the open: the earlier one stays readable.
          const earlier = h.state !== "open" && h.decision ? h.decision : undefined;
          if (earlier && !reason) throw new UsageError(`${id} is already ${h.state}: "${truncate(earlier, 80)}"`, { hint: 'deciding again needs --reason (e.g. "the marriage entry of 1839 overturns it")' });
          const notes = earlier ? [...h.notes, makeNote(tree, truncate(`earlier ${h.state}: ${earlier}`, 480))] : h.notes;
          const chosen = opts.variant === undefined ? undefined : h.variants.find((x) => foldText(x.label) === foldText(String(opts.variant)));
          if (opts.variant !== undefined && !chosen) throw new UsageError(`no variant ${String(opts.variant)} in ${id}`, { hint: h.variants.map((x) => x.label).join(", ") });
          const { chosen: _was, ...rest } = h;
          return { ...rest, state: opts.abandon ? "abandoned" : "decided", decision: String(opts.decision), ...(chosen ? { chosen: chosen.label } : {}), notes };
        },
        { op: "hypothesis.decide", summary: `${id} ${opts.abandon ? "abandoned" : "decided"}${opts.variant !== undefined ? ` for ${String(opts.variant)}` : ""}${reason ? " again" : ""}`, reason },
      );
      // decided: the sources it names that its people's facts do not cite yet — what they say goes on the people now
      const unrecorded = opts.abandon ? [] : sourcesNotOnPeople(tree, h);
      const say = unrecorded.map((u) => `${u.person}: ${u.sources.join(", ")} — named by ${id}, cited by none of ${u.person}'s facts: what they say of ${u.person} goes on ${u.person} now (event add ${u.person} … --cite ${u.sources[0]}); a note or the diary does not reach the tree`);
      return { text: lines(written(tree), ...say, stillOpen(tree, id)), data: { hypothesis: h, ...(unrecorded.length ? { unrecorded } : {}) } };
    },
  },
  {
    path: ["hypothesis", "list"],
    summary: "Open hypotheses",
    group: "analysis",
    tree: true,
    options: [
      { name: "all", type: "boolean", description: "include decided and abandoned" },
      { name: "unlinked", type: "boolean", description: "only those no variant of which says what it would connect (strom hypothesis link), but those whose every variant naming people says what the tree records already" },
    ],
    examples: ["strom hypothesis list", "strom hypothesis list --unlinked"],
    run(ctx, { opts }) {
      const tree = ctx.tree();
      // a hypothesis whose variants say only what the tree records already has nothing to link
      const linked = (h: Hypothesis) => h.variants.some((v) => v.links?.length) || (h.variants.some((v) => recordedLinks(tree, h, v).length) && !h.variants.some((v) => toLink(tree, h, v)));
      const all = tree.list<Hypothesis>("hypothesis").filter((h) => (opts.all || h.state === "open") && !(opts.unlinked && linked(h)));
      const links = (h: Hypothesis) => h.variants.reduce((n, v) => n + (v.links?.length ?? 0), 0);
      return {
        text: all.length
          ? table(all.map((h) => [h.id, h.state, truncate(h.question, 60), h.variants.map((v) => v.label).join("/"), links(h) ? `${links(h)} link${links(h) === 1 ? "" : "s"}` : ""]))
          : opts.unlinked
            ? "no open hypothesis without links"
            : "no open hypotheses",
        data: { hypotheses: all },
      };
    },
  },
  {
    path: ["hypothesis", "show"],
    summary: "One hypothesis with all variants and arguments",
    group: "analysis",
    tree: true,
    args: [{ name: "hypothesis", description: "hypothesis ID", required: true }],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const h = requireRecord<Hypothesis>(tree, args[0]!, "hypothesis");
      // a variant saying what the tree records already: no link to make, the hypothesis open until the records decide it
      const recorded = Object.fromEntries(h.variants.map((v) => [v.label, recordedLinks(tree, h, v)] as const).filter(([, l]) => l.length));
      return {
        text: lines(
          `${h.id} ${h.question}  [${h.state}]`,
          `about  ${h.subject.join(" ")}`,
          taskLines(tree, h.id),
          ...h.variants.flatMap((v) => [
            `\n${v.label}: ${v.claim}`,
            ...v.support.map((s) => `  + ${s}`),
            ...v.against.map((s) => `  − ${s}`),
            ...(v.links ?? []).map((l) => `  ⇢ ${linkText(l)}`),
            ...(recorded[v.label] ? [`  = ${recordedText(recorded[v.label]!)}`] : []),
          ]),
          h.decision ? `\ndecision${h.chosen ? ` (for ${h.chosen})` : ""}  ${h.decision}` : undefined,
        ),
        data: { hypothesis: h, ...(Object.keys(recorded).length ? { recorded } : {}) },
      };
    },
  },
);

// ── lessons ────────────────────────────────────────────────────────────────

register(
  {
    path: ["lesson", "add"],
    summary: "Record something learned — attached to what it is about, one sentence",
    group: "analysis",
    tree: true,
    writes: true,
    description: `A lesson on a record set, archive or place is shown to whoever works with it next.\nRule: one sentence, max ${LESSON_MAX} characters (a longer one: its start is the rule, the rest goes into its detail); details in --detail.`,
    args: [{ name: "rule", description: "the lesson as one rule", required: true }],
    options: [
      { name: "scope", type: "string", value: "<scope>", description: `${LESSON_SCOPES.join(", ")} (default: from --on, else project)` },
      { name: "on", type: "string", value: "<B…|R…|L…>", description: "what it is about" },
      { name: "detail", type: "string", value: "<text>", description: "the longer story", max: LESSON_DETAIL_MAX },
    ],
    examples: ['strom lesson add "Folio = 2 × image + 1, checked at six anchors" --on B0001'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      let rule = args[0]!.trim();
      let detail = typeof opts.detail === "string" && opts.detail.trim() ? opts.detail.trim() : undefined;
      // a rule longer than one: its first sentence is the rule, the rest goes before its detail — said, never an
      // error the agent answers by cutting the lesson short (K3)
      if ([...rule].length > LESSON_MAX) {
        const was = [...rule].length;
        const { head, rest } = splitText(rule, LESSON_MAX - 2);
        rule = `${head} …`;
        detail = [`… ${rest}`, detail].filter(Boolean).join("\n");
        tree.notices.push(`note: the rule was ${was} characters (a rule holds ${LESSON_MAX}): its start is the rule, the rest went into its detail (strom show <K…>)`);
      }
      if (detail && [...detail].length > LESSON_DETAIL_MAX) throw new UsageError(`the rule's detail is ${[...detail].length} characters (max ${LESSON_DETAIL_MAX})`, { hint: "the lesson in short; a long story of a record set belongs in its notes: strom recordset edit B… --note \"…\"" });
      const target = opts.on ? normId(String(opts.on)) : undefined;
      const type = target ? typeOfId(target) : undefined;
      if (target && (!type || !["repository", "recordset", "place"].includes(type) || !tree.get(target)))
        throw new UsageError(`--on must be an existing record set, repository or place`);
      const scope = opts.scope ? oneOf(opts.scope, LESSON_SCOPES, "scope") : ((type as Lesson["scope"] | undefined) ?? "project");
      const l = create<Lesson>(tree, "lesson", { scope, target, rule, detail }, (id) => `+${id} lesson "${truncate(rule, 60)}"`, target ? [target] : []);
      return { text: written(tree), data: { lesson: l } };
    },
  },
  {
    path: ["lesson", "edit"],
    summary: "Correct a lesson: its rule, its detail, what it is about — a change with the reason",
    group: "analysis",
    tree: true,
    writes: true,
    description:
      "Only the options given change; --note adds a note. Changing the rule, the scope, what it is on, or a detail it\n" +
      `has needs --reason (a lesson found wrong or out of date); adding a detail it lacks doesn't. A rule over ${LESSON_MAX}\n` +
      "characters: its start is the rule, the rest goes before its detail.",
    args: [{ name: "lesson", description: "lesson ID (K0001)", required: true }],
    options: [
      { name: "rule", type: "string", value: "<text>", description: "the lesson as one rule, corrected" },
      { name: "detail", type: "string", value: "<text>", description: "the longer story (replaces it)", max: LESSON_DETAIL_MAX },
      { name: "scope", type: "string", value: "<scope>", description: LESSON_SCOPES.join(", ") },
      { name: "on", type: "string", value: "<B…|R…|L…>", description: "what it is about (its scope from it, unless --scope)" },
      { name: "note", type: "string", value: "<text>", description: "a note added to it" },
    ],
    examples: ['strom lesson edit K0001 --rule "Folio = 2 × image + 3 from image 120 on" --reason "the numbering jumps at image 120"', 'strom lesson edit K0001 --detail "Checked at images 10, 60, 118, 121, 200."'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const id = requireRecord<Lesson>(tree, args[0]!, "lesson").id;
      const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
      let rule = text(opts.rule);
      let detail = text(opts.detail);
      const note = text(opts.note);
      const reason = text(opts.reason);
      if (rule && [...rule].length > LESSON_MAX) {
        const was = [...rule].length;
        const { head, rest } = splitText(rule, LESSON_MAX - 2);
        rule = `${head} …`;
        detail = [`… ${rest}`, detail ?? tree.get<Lesson>(id)?.detail].filter(Boolean).join("\n");
        tree.notices.push(`note: the rule was ${was} characters (a rule holds ${LESSON_MAX}): its start is the rule, the rest went into its detail (strom show ${id})`);
      }
      if (detail && [...detail].length > LESSON_DETAIL_MAX) throw new UsageError(`the rule's detail is ${[...detail].length} characters (max ${LESSON_DETAIL_MAX})`, { hint: "the lesson in short; a long story of a record set belongs in its notes: strom recordset edit B… --note \"…\"" });
      const target = opts.on ? normId(String(opts.on)) : undefined;
      const type = target ? typeOfId(target) : undefined;
      if (target && (!type || !["repository", "recordset", "place"].includes(type) || !tree.get(target)))
        throw new UsageError(`--on must be an existing record set, repository or place`);
      const scope = opts.scope !== undefined ? oneOf(opts.scope, LESSON_SCOPES, "scope") : target ? (type as Lesson["scope"]) : undefined;
      const given: Partial<Lesson> = { ...(rule ? { rule } : {}), ...(detail ? { detail } : {}), ...(scope ? { scope } : {}), ...(target ? { target } : {}) };
      const l = update<Lesson>(
        tree,
        id,
        "lesson",
        (cur) => {
          if (cur.retracted) throw new UsageError(`${id} is retracted (${cur.retracted.reason}) — what holds now is a new lesson`, { hint: 'strom lesson add "…"' });
          const keys = (Object.keys(given) as (keyof Lesson)[]).filter((k) => cur[k] !== given[k]);
          if (!keys.length && !note) throw new UsageError("nothing to change", { hint: "strom help lesson edit" });
          // what a lesson says is what the next session goes by: changing it needs a reason, filling in a detail doesn't
          const changed = keys.filter((k) => cur[k] !== undefined);
          if (changed.length && !reason)
            throw new UsageError(`changing ${changed.map((k) => `--${k === "target" ? "on" : k}`).join(", ")} of ${id} needs --reason`, {
              hint: 'e.g. --reason "the numbering jumps at image 120"',
              code: "record.needs-reason",
              params: { id, fields: changed.map((k) => `--${k === "target" ? "on" : k}`).join(", ") },
            });
          return { ...cur, ...given, ...(note ? { notes: [...cur.notes, ...makeNotes(tree, note)] } : {}) };
        },
        { op: "lesson.edit", summary: `${id} ${[...Object.keys(given).map((k) => (k === "target" ? "on" : k)), ...(note ? ["note"] : [])].join(", ")}`, reason, targets: target ? [target] : [] },
      );
      return { text: written(tree), data: { lesson: l } };
    },
  },
  {
    path: ["lesson", "list"],
    summary: "Lessons (optionally only those about one record set, archive or place)",
    group: "analysis",
    tree: true,
    options: [
      { name: "on", type: "string", value: "<B…|R…|L…>", description: "only lessons about this" },
      { name: "scope", type: "string", value: "<scope>", description: `only lessons of this scope: ${LESSON_SCOPES.join(", ")}` },
    ],
    run(ctx, { opts }) {
      const target = opts.on ? normId(String(opts.on)) : undefined;
      const scope = opts.scope === undefined ? undefined : oneOf(opts.scope, LESSON_SCOPES, "scope");
      const all = ctx.tree().list<Lesson>("lesson").filter((l) => !l.retracted && (!target || l.target === target) && (!scope || l.scope === scope));
      return { text: all.length ? table(all.map((l) => [l.id, l.scope, l.target ?? "", l.rule])) : "no lessons", data: { lessons: all } };
    },
  },
);

// ── find and gaps ──────────────────────────────────────────────────────────

/** Searchable text of a record, for `strom find`. */
function haystack(r: AnyRecord): string {
  const parts: string[] = [];
  const add = (v: unknown) => {
    if (typeof v === "string") parts.push(v);
    else if (Array.isArray(v)) v.forEach(add);
    else if (v && typeof v === "object") Object.values(v).forEach(add);
  };
  const { id: _i, type: _t, created: _c, updated: _u, ...rest } = r as unknown as Record<string, unknown>;
  // a person's titles ("Ing.", "ml.") are never searched as their name — the Strom app finds nobody by them either
  if (r.type === "person") rest.names = r.names.map(({ prefix: _p, suffix: _s, ...n }) => n);
  add(rest);
  return parts.join(" \u0001 ");
}

function label(tree: Tree, r: AnyRecord): string {
  switch (r.type) {
    case "person":
      return `${displayName(r)}${lifespan(r) ? ` (${lifespan(r)})` : ""}`;
    case "family":
      return r.partners.map((p) => tree.get<Person>(p)).filter(Boolean).map((p) => displayName(p!)).join(" & ") || "family";
    case "research":
      return r.name;
    case "source":
    case "recordset":
      return r.title;
    case "repository":
      return r.name;
    case "place":
      return r.names[0]?.name ?? r.id;
    case "search":
      return r.question;
    case "task":
      return r.what;
    case "conflict":
      return r.title;
    case "hypothesis":
      return r.question;
    case "lesson":
      return r.rule;
    case "input":
      return r.name;
    case "session":
      return r.summary ?? `session ${r.state}`;
    case "media":
      return `image ${r.image ?? "?"}${r.recordset ? ` of ${r.recordset}` : ""}${r.from ? ` (${r.from})` : ""}`;
  }
}

register(
  {
    path: ["find"],
    summary: "Full-text search across everything (people, sources, transcripts, searches, tasks, notes)",
    group: "analysis",
    tree: true,
    description: "Words in one argument must all be there. Several arguments are several searches in one go (e.g. old codes\nof a converted research) — each answered on its own.",
    args: [{ name: "text", description: "words to find (diacritics optional); several arguments = several searches", required: true, variadic: true }],
    options: [{ name: "type", type: "string", value: "<type>", description: `only one record type: ${Object.keys(RECORD_TYPES).join(", ")}`, aliases: ["kind"] }],
    examples: ['strom find "čp. 12"', "strom find mlynar --type source", "strom find \"č. 12\" \"č. 15\" mlynar"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const types = (opts.type ? [String(opts.type)] : Object.keys(RECORD_TYPES)) as RecordType[];
      if (opts.type && !(String(opts.type) in RECORD_TYPES)) throw new UsageError(`unknown type "${opts.type}"`, { hint: Object.keys(RECORD_TYPES).join(", ") });
      const queries = [...new Set(args.map((a) => a.trim()).filter(Boolean))];
      if (!queries.length) throw new UsageError("what to find?", { hint: 'strom find "čp. 12"' });
      const records = types.flatMap((t) => tree.list(t)).map((r) => ({ r, hay: haystack(r) })).map((x) => ({ ...x, folded: foldText(x.hay) }));
      type Hit = { query?: string; id: string; type: string; label: string; snippet: string };
      const hits: Hit[] = [];
      const missing: string[] = [];
      for (const q of queries) {
        const words = foldText(q).split(" ").filter(Boolean);
        const mine: { hit: Hit; rank: number }[] = [];
        let n = 0;
        for (const { r, hay, folded } of records) {
          if (!words.every((w) => folded.includes(w))) continue;
          // the place in the text itself, not in its folded form (accents, spaces and "ß" change its length)
          const at = unfoldIndex(hay, folded.indexOf(words[0]!));
          let start = Math.max(0, at - 30);
          while (start > 0 && start < at && hay[start - 1] !== " ") start++; // begin at a word
          const snippet = hay.slice(start, at + 70).replace(/\u0001/g, "·");
          const named = label(tree, r);
          // the record itself first (its ID), then those named so (title, name), then a word in their text (K14)
          const rank = r.id === normId(q) ? 0 : words.every((w) => foldText(named).includes(w)) ? 1 : 2;
          mine.push({ hit: { ...(queries.length > 1 ? { query: q } : {}), id: r.id, type: r.type, label: truncate(named, 50), snippet: truncate(snippet, 100) }, rank });
          n++;
        }
        hits.push(...mine.sort((a, b) => a.rank - b.rank).map((m) => m.hit));
        if (!n) missing.push(q);
      }
      const page = paginate(hits, ctx.limit, ctx.page);
      const more = moreLine(page, `strom find ${queries.map((q) => `"${q}"`).join(" ")}`);
      if (queries.length === 1)
        return {
          text: hits.length ? lines(table(page.items.map((h) => [h.id, h.type, h.label, h.snippet])), more) : "nothing found",
          data: { total: hits.length, hits: page.items },
        };
      const shown = queries.filter((q) => page.items.some((h) => h.query === q));
      return {
        text: lines(
          ...shown.map((q) => lines(`${q}`, table(page.items.filter((h) => h.query === q).map((h) => [`  ${h.id}`, h.type, h.label, h.snippet])))),
          missing.length ? `nothing found for: ${missing.join(", ")}` : undefined,
          more,
        ),
        data: { total: hits.length, hits: page.items, missing },
      };
    },
  },
  {
    path: ["gaps"],
    summary: "Where the most work is: people with missing birth, death, parents, marriage or evidence",
    group: "analysis",
    tree: true,
    options: [{ name: "research", type: "string", value: "<G…>", description: "only people in this research (with generations)" }],
    run(ctx, { opts }) {
      const tree = ctx.tree();
      let people = tree.list<Person>("person").filter((p) => !p.retracted);
      let gens: Map<string, number> | undefined;
      if (opts.research) {
        const r = resolveResearch(tree, String(opts.research)) as Research;
        gens = ancestorGenerations(tree, r.focus, r.limits?.generations ?? 50);
        people = people.filter((p) => gens!.has(p.id));
      }
      const rows = people
        .map((p) => {
          const gaps: string[] = [];
          if (!birthEvent(p)) gaps.push("birth");
          if (!deathEvent(p)) gaps.push("death");
          if (parentsOf(tree, p.id).length < 2) gaps.push("parents");
          for (const f of familiesAsPartner(tree, p.id) as Family[]) if (!f.events.some((e) => e.kind === "MARR" && !e.retracted)) gaps.push(`marriage ${f.id}`);
          if (!p.events.some((e) => e.citations.length > 0) && !p.names.some((n) => n.citations?.length)) gaps.push("no evidence");
          return { p, gaps };
        })
        .filter((x) => x.gaps.length)
        .sort((a, b) => (gens ? gens.get(a.p.id)! - gens.get(b.p.id)! : 0) || b.gaps.length - a.gaps.length);
      const page = paginate(rows, ctx.limit, ctx.page);
      return {
        text: rows.length
          ? lines(table(page.items.map(({ p, gaps }) => [p.id, displayName(p), lifespan(p), gens ? `G${gens.get(p.id)}` : "", gaps.join(", ")])), moreLine(page, "strom gaps"))
          : "no gaps — every person has birth, death, parents and evidence",
        data: { total: rows.length, gaps: page.items.map(({ p, gaps }) => ({ id: p.id, name: displayName(p), gaps, generation: gens?.get(p.id) })) },
      };
    },
  },
);
