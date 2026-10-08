// search · searched · conflict · hypothesis · lesson · find · gaps

import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { ui, type UIKey } from "../cli/ui.ts";
import { lines, moreLine, paginate, table, truncate } from "../cli/format.ts";
import { UsageError } from "../core/errors.ts";
import {
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
} from "../core/model.ts";
import { create, csvOpt, listOpt, normId, requireRecord, update } from "../core/records.ts";
import { ancestorGenerations, birthEvent, claimText, conflictTitle, deathEvent, displayName, familiesAsPartner, lifespan, parentsOf, primaryName, resolvePerson } from "../core/people.ts";
import { changeLines } from "../core/changelog.ts";
import { isAgent } from "../core/which.ts";
import { foldText } from "../core/text.ts";
import { makeNote } from "../core/actions.ts";
import { takeSide } from "../core/sync.ts";
import { currentSession } from "../core/session.ts";
import { typeOfId, type Tree } from "../core/tree.ts";
import { resolveResearch } from "./research.ts";

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
      if (!tree.get(id)) throw new UsageError(`no record ${id}`);
      return id;
    }
    return resolvePerson(tree, r).id;
  });
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

// ── searches ───────────────────────────────────────────────────────────────

function yearsRange(y?: string): [number, number] | undefined {
  const m = y ? /^(\d{3,4})(?:-(\d{3,4}))?$/.exec(y) : null;
  return m ? [Number(m[1]), Number(m[2] ?? m[1])] : undefined;
}

function overlaps(a?: string, b?: string): boolean {
  const x = yearsRange(a);
  const y = yearsRange(b);
  if (!x || !y) return true;
  return x[0] <= y[1] && y[0] <= x[1];
}

function searchLine(s: Search): string[] {
  return [s.id, s.result, s.method, truncate(s.question, 60), s.scope.years ?? "", (s.scope.surnames ?? []).join(","), s.recordsets.join(" "), s.by === "main" ? "" : `by ${s.by}`];
}

register(
  {
    path: ["search", "add"],
    summary: "Record a search — ALSO when nothing was found (negative results are results)",
    group: "analysis",
    tree: true,
    writes: true,
    args: [{ name: "question", description: 'what was looked for: "Baptisms Novák 1903–1907"', required: true }],
    options: [
      { name: "recordset", type: "string", multiple: true, value: "<B…>", description: "where (repeatable)" },
      { name: "years", type: "string", value: "<from-to>", description: "years covered" },
      { name: "surname", type: "string", multiple: true, value: "<name>", description: "surnames looked for (repeatable)" },
      { name: "place", type: "string", multiple: true, value: "<name>", description: "places covered (repeatable)" },
      { name: "pages", type: "string", value: "<range>", description: "images/pages covered, e.g. 95-100" },
      { name: "method", type: "string", value: "<m>", description: SEARCH_METHODS.join(", ") },
      { name: "result", type: "string", value: "<r>", description: SEARCH_RESULTS.join(", ") },
      { name: "found", type: "string", multiple: true, value: "<S…>", description: "sources found (repeatable)" },
      { name: "task", type: "string", value: "<T…>", description: "task this search served (default: the task of the open session)" },
      { name: "by", type: "string", value: "<who>", description: "main (default), reader, user" },
      { name: "note", type: "string", value: "<text>", description: "what was illegible, what is left" },
    ],
    examples: ['strom search add "Křty Novák 1903–1907" --recordset B0001 --years 1903-1907 --surname Novák --method page-by-page --result negative --task T0001'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const recordsets = csvOpt(opts.recordset).map((b) => requireRecord<RecordSet>(tree, b, "recordset").id);
      const years = opts.years ? String(opts.years) : undefined;
      if (years && !yearsRange(years)) throw new UsageError(`invalid --years "${years}"`, { hint: "1903 or 1903-1907" });
      const findings = csvOpt(opts.found).map((s) => requireRecord(tree, s, "source").id);
      const result = oneOf(opts.result, SEARCH_RESULTS, "result");
      if (result === "found" && findings.length === 0) throw new UsageError("result found needs --found <S…>", { hint: "create the source first: strom source add …" });
      // A search made in a session served that session's task, unless it says otherwise.
      const task = opts.task ? requireRecord(tree, String(opts.task), "task").id : currentSession(tree, ctx.env)?.task;
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
      return { text: written(tree), data: { search: s } };
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
      { name: "recordset", type: "string", multiple: true, value: "<B…>", description: "where (repeatable; replaces)" },
      { name: "no-recordset", type: "boolean", description: "it was not in a record set (a catalog, the web): take them off" },
      { name: "years", type: "string", value: "<from-to>", description: "years covered" },
      { name: "surname", type: "string", multiple: true, value: "<name>", description: "surnames looked for (repeatable; replaces)" },
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
      const years = opts.years === undefined ? undefined : String(opts.years);
      if (years !== undefined && !yearsRange(years)) throw new UsageError(`invalid --years "${years}"`, { hint: "1903 or 1903-1907" });
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
      const note = typeof opts.note === "string" && opts.note.trim() ? makeNote(tree, opts.note) : undefined;
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
          const next: Search = { ...cur, ...change, scope: { ...cur.scope, ...scope }, ...(note ? { notes: [...cur.notes, note] } : {}) };
          if (next.result === "found" && next.findings.length === 0) throw new UsageError("result found needs --found <S…>", { hint: "create the source first: strom source add …" });
          return next;
        },
        { op: "search.edit", summary: `${id} ${fields.join(", ")}`, reason, targets: [...(change.recordsets ?? []), ...(change.findings ?? [])] },
      );
      return { text: written(tree), data: { search: s } };
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
        const sur = foldText(primaryName(p).surname);
        what = `${p.id} ${displayName(p)}`;
        match = (s) => (s.scope.surnames ?? []).some((x) => foldText(x) === sur) || (!!s.task && tree.get<{ subject?: string[] } & AnyRecord>(s.task) !== undefined && ((tree.get(s.task) as { subject?: string[] }).subject ?? []).includes(p.id));
      } else {
        const key = foldText(q);
        match = (s) =>
          (s.scope.surnames ?? []).some((x) => foldText(x) === key) ||
          (s.scope.places ?? []).some((x) => foldText(x).includes(key)) ||
          foldText(s.question).includes(key) ||
          s.recordsets.some((b) => {
            const r = tree.get<RecordSet>(b);
            return !!r && (foldText(r.title).includes(key) || r.places.some((pl) => foldText(pl).includes(key)));
          });
      }
      const years = opts.years ? String(opts.years) : undefined;
      const hits = tree.list<Search>("search").filter((s) => match(s) && overlaps(s.scope.years, years));
      const negative = hits.filter((s) => s.result === "negative").length;
      const text = hits.length
        ? lines(`${hits.length} search(es) for ${what}${years ? ` in ${years}` : ""} — ${negative} negative, ${hits.length - negative} with results`, table(hits.map(searchLine)))
        : `nothing searched yet for ${what}${years ? ` in ${years}` : ""}`;
      return { text, data: { searches: hits } };
    },
  },
);

// ── conflicts and hypotheses ───────────────────────────────────────────────

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
    args: [{ name: "conflict", description: "conflict ID (X0001)", required: true }],
    options: [
      { name: "resolution", type: "string", value: "<text>", description: "the conclusion (with --take: the value taken, by default)" },
      { name: "reasoning", type: "string", value: "<text>", description: "why — which evidence outweighs which" },
      { name: "take", type: "string", value: "<user|research>", description: "a conflict of the user's edit in the Strom app: whose value the fact keeps — the user's is written into it" },
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const id = normId(args[0]!, "conflict");
      const c0 = requireRecord<Conflict>(tree, id, "conflict");
      const take = opts.take === undefined ? undefined : String(opts.take).toLowerCase();
      if (take !== undefined && take !== "user" && take !== "research") throw new UsageError(`--take is user or research, not "${opts.take}"`, { code: "conflict.take", params: { take: String(opts.take) } });
      // a conflict of the user's edit in the Strom app: a fact's, a child's parents, a name's or a sex's
      const ofEdit = Boolean(c0.edit || c0.parents || (["NAME", "SEX", "NPFX", "NSFX"].includes(c0.fact ?? "") && c0.claims.some((c) => c.note === "the user's edit")));
      if (take && !ofEdit) throw new UsageError(`${id} is no conflict of an edit in the Strom app: write what you conclude with the commands that change facts, then resolve it with --resolution`, { hint: `strom conflict show ${id}`, code: "conflict.no-edit", params: { id } });
      // the conclusion naming one side's value exactly: that side taken (found on Mac: "tesař" resolved, the fact left
      // "kovář", the app then showing kovář in silence)
      const user = c0.claims.find((c) => c.note === "the user's edit");
      const research = c0.claims.find((c) => c.note?.startsWith("the research"));
      const said = opts.resolution ? foldText(String(opts.resolution)).trim() : undefined;
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
      let did: string | undefined;
      const x = tree.withTreeLock(() => {
        if (side) did = takeSide(tree, tree.get<Conflict>(id)!, side, String(opts.reasoning));
        return update<Conflict>(tree, id, "conflict", (c) => ({ ...c, state: "resolved", resolution, reasoning: String(opts.reasoning) }), {
          op: "conflict.resolve",
          summary: `${id} resolved${side ? ` — the ${side === "user" ? "user's edit" : "research's"} taken` : ""}`,
        });
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
    options: [{ name: "all", type: "boolean", description: "include resolved" }],
    run(ctx, { opts }) {
      const tree = ctx.tree();
      const all = tree.list<Conflict>("conflict").filter((c) => opts.all || c.state === "open");
      return { text: all.length ? table(all.map((c) => [c.id, ui(tree.lang, c.state === "resolved" ? "ui.conflict.state.resolved" : "ui.conflict.state.open"), truncate(conflictTitle(tree, c), 60), c.subject.join(" ")])) : ui(tree.lang, opts.all ? "ui.conflict.none.all" : "ui.conflict.none"), data: { conflicts: all } };
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
      const variants = listOpt(opts.variant).map((v, i) => {
        const m = /^([\p{L}\p{N}]{1,3})\s*:\s*(.+)$/u.exec(v);
        return { label: m ? m[1]! : String.fromCharCode(65 + i), claim: (m ? m[2]! : v).trim(), support: [], against: [] };
      });
      if (variants.length < 2) throw new UsageError("a hypothesis needs at least two --variant");
      const subject = anyRefs(tree, listOpt(opts.about));
      if (!subject.length) throw new UsageError("--about is required");
      const h = create<Hypothesis>(tree, "hypothesis", { question: args[0]!.trim(), subject, variants, state: "open", note: opts.note as string | undefined }, (id) => `+${id} hypothesis "${truncate(args[0]!, 60)}"`, subject);
      return { text: written(tree), data: { hypothesis: h } };
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
    path: ["hypothesis", "decide"],
    summary: "Decide a hypothesis (or abandon it) — again, with a reason, when a new record overturns the decision",
    group: "analysis",
    tree: true,
    writes: true,
    description: "Deciding again keeps the earlier decision in a note; it needs --reason.",
    args: [{ name: "hypothesis", description: "hypothesis ID", required: true }],
    options: [
      { name: "decision", type: "string", value: "<text>", description: "which variant and why" },
      { name: "abandon", type: "boolean", description: "none of the variants can be decided" },
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      if (!opts.decision) throw new UsageError("--decision is required");
      const id = normId(args[0]!, "hypothesis");
      const reason = typeof opts.reason === "string" && opts.reason.trim() ? opts.reason.trim() : undefined;
      const h = update<Hypothesis>(
        tree,
        id,
        "hypothesis",
        (h) => {
          // A decision is overturned in the open: the earlier one stays readable.
          const earlier = h.state !== "open" && h.decision ? h.decision : undefined;
          if (earlier && !reason) throw new UsageError(`${id} is already ${h.state}: "${truncate(earlier, 80)}"`, { hint: 'deciding again needs --reason (e.g. "the marriage entry of 1839 overturns it")' });
          const notes = earlier ? [...h.notes, makeNote(tree, truncate(`earlier ${h.state}: ${earlier}`, 480))] : h.notes;
          return { ...h, state: opts.abandon ? "abandoned" : "decided", decision: String(opts.decision), notes };
        },
        { op: "hypothesis.decide", summary: `${id} ${opts.abandon ? "abandoned" : "decided"}${reason ? " again" : ""}`, reason },
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
    options: [{ name: "all", type: "boolean", description: "include decided and abandoned" }],
    run(ctx, { opts }) {
      const all = ctx.tree().list<Hypothesis>("hypothesis").filter((h) => opts.all || h.state === "open");
      return {
        text: all.length ? table(all.map((h) => [h.id, h.state, truncate(h.question, 60), h.variants.map((v) => v.label).join("/")])) : "no open hypotheses",
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
      return {
        text: lines(
          `${h.id} ${h.question}  [${h.state}]`,
          `about  ${h.subject.join(" ")}`,
          taskLines(tree, h.id),
          ...h.variants.flatMap((v) => [`\n${v.label}: ${v.claim}`, ...v.support.map((s) => `  + ${s}`), ...v.against.map((s) => `  − ${s}`)]),
          h.decision ? `\ndecision  ${h.decision}` : undefined,
        ),
        data: { hypothesis: h },
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
    description: `A lesson on a record set, archive or place is shown to whoever works with it next.\nRule: one sentence, max ${LESSON_MAX} characters; details in --detail.`,
    args: [{ name: "rule", description: "the lesson as one rule", required: true }],
    options: [
      { name: "scope", type: "string", value: "<scope>", description: `${LESSON_SCOPES.join(", ")} (default: from --on, else project)` },
      { name: "on", type: "string", value: "<B…|R…|L…>", description: "what it is about" },
      { name: "detail", type: "string", value: "<text>", description: "the longer story" },
    ],
    examples: ['strom lesson add "Folio = 2 × image + 1, checked at six anchors" --on B0001'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const rule = args[0]!.trim();
      if ([...rule].length > LESSON_MAX) throw new UsageError(`the rule is ${[...rule].length} characters (max ${LESSON_MAX})`, { hint: "one sentence as the rule, the story in --detail" });
      const target = opts.on ? normId(String(opts.on)) : undefined;
      const type = target ? typeOfId(target) : undefined;
      if (target && (!type || !["repository", "recordset", "place"].includes(type) || !tree.get(target)))
        throw new UsageError(`--on must be an existing record set, repository or place`);
      const scope = opts.scope ? oneOf(opts.scope, LESSON_SCOPES, "scope") : ((type as Lesson["scope"] | undefined) ?? "project");
      const l = create<Lesson>(tree, "lesson", { scope, target, rule, detail: opts.detail as string | undefined }, (id) => `+${id} lesson "${truncate(rule, 60)}"`, target ? [target] : []);
      return { text: written(tree), data: { lesson: l } };
    },
  },
  {
    path: ["lesson", "list"],
    summary: "Lessons (optionally only those about one record set, archive or place)",
    group: "analysis",
    tree: true,
    options: [{ name: "on", type: "string", value: "<B…|R…|L…>", description: "only lessons about this" }],
    run(ctx, { opts }) {
      const target = opts.on ? normId(String(opts.on)) : undefined;
      const all = ctx.tree().list<Lesson>("lesson").filter((l) => !target || l.target === target);
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
    options: [{ name: "type", type: "string", value: "<type>", description: `only one record type: ${Object.keys(RECORD_TYPES).join(", ")}` }],
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
        let n = 0;
        for (const { r, hay, folded } of records) {
          if (!words.every((w) => folded.includes(w))) continue;
          const at = folded.indexOf(words[0]!);
          let start = Math.max(0, at - 30);
          while (start > 0 && start < at && hay[start - 1] !== " ") start++; // begin at a word
          const snippet = hay.slice(start, at + 70).replace(/\u0001/g, "·");
          hits.push({ ...(queries.length > 1 ? { query: q } : {}), id: r.id, type: r.type, label: truncate(label(tree, r), 50), snippet: truncate(snippet, 100) });
          n++;
        }
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
