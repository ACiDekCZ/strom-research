// strom query — the facts of the tree as rows, for questions over the data ("how many millers in the family", "who
// lived in house 12", "the births of a surname in a century"): one call gives who (with the relation to the main
// person in words, the side and the generation), what, where, when, how sure and on what source — counted and grouped
// when asked. Read only (core/facts.ts). strom find stays the search of any text.

import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { counted, lines, LIST_PAGE_MAX, moreLine, paginate, shellArg, truncate } from "../cli/format.ts";
import { ui, type UIKey } from "../cli/ui.ts";
import { eventName, humanDate, humanPlace, statusName } from "../cli/human.ts";
import { UsageError } from "../core/errors.ts";
import { ASKED_STATUSES, FACT_GROUPS, KIN_SETS, factKind, findFacts, findStories, groupRows, parseYears, personLabel, termLang, type FactGroup, type FactQuery, type FactRow, type KinSet, type StoryRow } from "../core/query.ts";
import { houseHasWord } from "../core/house.ts";
import { OCCUPATIONS_FILE } from "../core/occupations.ts";
import { mainPerson } from "../core/kin.ts";
import { displayName, lifespan, resolvePerson } from "../core/people.ts";
import { csvOpt, listOpt } from "../core/records.ts";
import { EVENT_KINDS, eventKind, type Person, type Status } from "../core/model.ts";
import { relationText } from "../core/relation.ts";
import { personUrl, treeUrl } from "../core/widget.ts";
import { wordsFor } from "./people.ts";
import type { Tree } from "../core/tree.ts";

const WIDER: Record<KinSet, KinSet | undefined> = { ancestors: "blood", blood: "family", family: "all", all: undefined };

/** The English words of a set (an agent's text); a person reads them in the research's language (ui.query.kin.*). */
const KIN_EN: Record<KinSet, string> = {
  ancestors: "{of} and the ancestors",
  blood: "blood relatives of {of}",
  family: "relatives of {of} and their partners",
  all: "everyone in the tree, related to {of}",
};

function oneOf<T extends string>(value: unknown, allowed: readonly T[], name: string): T | undefined {
  if (value === undefined || value === false) return undefined;
  const v = String(value).trim().toLowerCase();
  if (!(allowed as readonly string[]).includes(v)) throw new UsageError(`--${name} takes ${allowed.join(", ")}`, { hint: `strom query --${name} ${allowed[0]}` });
  return v as T;
}

/** The person the relations are to: --of, else the main person; never a retracted one. */
function ofPerson(tree: Tree, ref: unknown): Person {
  const id = typeof ref === "string" && ref.trim() ? resolvePerson(tree, ref).id : mainPerson(tree);
  if (!id)
    throw new UsageError("no main person to relate the facts to", {
      hint: "strom config set main.person P0001 (the person the tree is for), or strom query --of P0001",
    });
  const p = tree.get<Person>(id);
  if (!p || p.retracted) throw new UsageError(`${id} is retracted: no facts are related to it`, { hint: "strom query --of P0001 (a person of the tree)" });
  return p;
}

/** The tree's link to a person in the Strom app; none when the tree has no link. */
function openOf(ctx: Context, tree: Tree): (id: string) => string | undefined {
  let base: string | undefined;
  try {
    base = treeUrl(ctx.env, tree.config.name, tree.config.id);
  } catch {
    base = undefined;
  }
  return (id) => (base ? personUrl(base, id) : undefined);
}

register({
  path: ["query"],
  summary: "The facts of the tree as rows: who (and how related), what, where, when, how sure, on what source — counted and grouped",
  group: "analysis",
  tree: true,
  description:
    "For questions over the data (how many, who, where, when): one row per fact of a person (a family's fact, a marriage,\n" +
    "for each partner), with the person's relation to the main person (--of) in the research's language, the side and the\n" +
    "generation (G1 the person, G2 the parents …), the value, place, house, date, status and the sources. A fact is what is\n" +
    "recorded of a person; strom find finds a word in any text (a name, a note). Retracted people and facts never;\n" +
    "disproven facts only with --status disproven. All filters together; --value repeated: any of the words. A word is\n" +
    "found at the start of a word of the value, label or cause (not the note), with any accent or none, and with the\n" +
    "forms of an occupation in Czech, German, Latin and Polish (mlynar finds Müller, molitor); --exact: the word itself.\n" +
    "--kin: ancestors (the person and the direct line), blood (the default: the ancestors and all their descendants,\n" +
    "the side branches too), family (blood and their partners), all (the whole tree). Answer with each person's name and\n" +
    "their ID in brackets after it, the relation in words whole as strom query gives it, never shortened, the source by\n" +
    "its title with its S… in brackets; the Strom app opens a person: strom app --person P0001.\n" +
    "--story <word>: the people (and couples) whose story holds the word (found as with --value), each with the sentence\n" +
    "and the sources it rests on where they can be told (else the story's); the other filters choose the people (those\n" +
    "with a fact answering them). A story retells the facts: answer from the facts and sources, a story only shows\n" +
    "where to look.\n" +
    "For answering the user and for finding where to look: whose a record is, who a person is, verifying and writing\n" +
    "facts go as ever through strom person show, the sources and the method — a row of strom query is not enough for it.",
  options: [
    { name: "kind", type: "string", multiple: true, value: "<tag>", description: "only facts of this kind: OCCU, RESI, BIRT, DEAT, MARR … (repeatable, or comma separated)" },
    { name: "occupation", type: "string", multiple: true, value: "<word>", description: "an occupation (OCCU) by a word, with its forms in other languages (repeatable: any)" },
    { name: "value", type: "string", multiple: true, value: "<word>", description: "a word of the value, label or cause (repeatable: any of them)" },
    { name: "exact", type: "boolean", description: "the words as whole words, without the forms of an occupation" },
    { name: "place", type: "string", value: "<name>", description: "the place, by the start of its words (any of its names)" },
    { name: "house", type: "string", value: "<number>", description: "the house number (12 is also č. 12, Nr. 12)" },
    { name: "years", type: "string", value: "<from-to>", description: "the fact's date within these years: 1750-1850, or one year: 1790" },
    { name: "surname", type: "string", value: "<surname>", description: "people of this surname (its other forms too: Lhotakova, the groups made one family)" },
    { name: "source", type: "string", value: "<S…|words>", description: "facts citing this source (its ID, or words of its title)" },
    { name: "status", type: "string", multiple: true, value: "<status>", description: `only facts this sure: ${ASKED_STATUSES.join(", ")} (repeatable); disproven only so` },
    { name: "story", type: "string", multiple: true, value: "<word>", description: "the stories holding this word, a row per story (repeatable: any of them)" },
    { name: "of", type: "string", value: "<P…>", description: "the person the relations are to (default: the main person, strom config get main.person)" },
    { name: "kin", type: "string", value: "<set>", description: `whose facts: ${KIN_SETS.join(", ")} (default blood)` },
    { name: "count", type: "boolean", description: "only the numbers (people, facts); with --by for each group" },
    { name: "by", type: "string", value: "<group>", description: `group by ${FACT_GROUPS.join(", ")} (with --count: numbers only)` },
  ],
  examples: [
    "strom query --occupation mlynar --count --by generation",
    "strom query --occupation mlynar",
    "strom query --place Lhota --house 12 --by kin",
    "strom query --surname Lhotak --years 1700-1800 --kind BIRT --count --by decade",
    "strom query --source S0001",
  ],
  run(ctx, { opts }) {
    const tree = ctx.tree();
    const w = wordsFor(ctx, tree);
    const lang = tree.lang;
    const tl = termLang(lang);
    const of = ofPerson(tree, opts.of);
    const kin = oneOf(opts.kin, KIN_SETS, "kin") ?? "blood";
    const by = oneOf(opts.by, FACT_GROUPS, "by") as FactGroup | undefined;
    const storyWords = listOpt(opts.story).filter((x) => x.trim());
    if (storyWords.length && (by === "place" || by === "decade"))
      throw new UsageError(`--by ${by} groups facts: with --story, --by takes generation, kin, surname`, { hint: `strom query --story ${shellArg(storyWords[0]!)} --by generation` });
    const occupations = listOpt(opts.occupation);
    const values = [...occupations, ...listOpt(opts.value)];
    let kinds = csvOpt(opts.kind);
    const unknown = kinds.find((k) => !eventKind(k.trim()));
    if (unknown !== undefined)
      throw new UsageError(`unknown --kind "${unknown}": --kind takes ${Object.keys(EVENT_KINDS).join(", ")} (or the English name: occupation, residence …)`, {
        hint: "strom query --kind OCCU",
      });
    if (occupations.length) {
      if (kinds.length && !kinds.some((k) => k.toUpperCase() === "OCCU" || k.toLowerCase() === "occupation"))
        throw new UsageError("--occupation is a fact of the kind OCCU: no other --kind beside it", { hint: `strom query --kind ${kinds[0]} --value ${shellArg(occupations[0]!)}` });
      kinds = ["OCCU"];
    }
    const statuses = listOpt(opts.status).flatMap((s) => s.split(",")).map((s) => oneOf(s, ASKED_STATUSES, "status")!) as Status[];
    const years = opts.years === undefined ? undefined : parseYears(String(opts.years));
    if (opts.years !== undefined && !years) throw new UsageError(`--years takes 1750-1850 or one year, not "${opts.years}"`, { hint: "strom query --years 1750-1850" });
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
    const q: FactQuery = {
      of: of.id,
      kin,
      ...(kinds.length ? { kinds } : {}),
      ...(values.length ? { values } : {}),
      ...(opts.exact ? { exact: true } : {}),
      ...(str(opts.place) ? { place: str(opts.place)! } : {}),
      ...(str(opts.house) ? { house: str(opts.house)! } : {}),
      ...(years ? { years } : {}),
      ...(str(opts.surname) ? { surname: str(opts.surname)! } : {}),
      ...(str(opts.source) ? { source: str(opts.source)! } : {}),
      ...(statuses.length ? { statuses } : {}),
    };
    // the stories holding a word (the other filters choose the people), else the facts
    const st = storyWords.length ? findStories(tree, q, storyWords) : undefined;
    const a = st ? undefined : findFacts(tree, q);

    // the command again (the next page, a wider set): its options as typed, plain words
    const typed: string[] = [];
    for (const k of kinds.length && !occupations.length ? kinds : []) typed.push("--kind", k);
    for (const o of occupations) typed.push("--occupation", shellArg(o));
    for (const v of listOpt(opts.value)) typed.push("--value", shellArg(v));
    if (opts.exact) typed.push("--exact");
    for (const k of ["place", "house", "years", "surname", "source"] as const) if (str(opts[k])) typed.push(`--${k}`, shellArg(str(opts[k])!));
    for (const s of statuses) typed.push("--status", s);
    for (const x of storyWords) typed.push("--story", shellArg(x));
    if (typeof opts.of === "string" && opts.of.trim()) typed.push("--of", of.id);
    const command = (more: string[]) => ["strom query", ...typed, ...more].join(" ");
    const kinArg = kin === "blood" ? [] : ["--kin", kin];

    // the words: an agent's English, a person's language at a terminal; a relation always in the research's language
    const say = (key: UIKey, english: string, params: Record<string, string | number> = {}) => (w.lang ? ui(w.lang, key, params) : fillEn(english, params));
    const ofText = `${of.id} ${personLabel(of)}`;
    const kinText = say(`ui.query.kin.${kin}` as UIKey, KIN_EN[kin], { of: ofText });
    const what = [
      ...(st
        ? [say("ui.query.story", "story {words}", { words: `${storyWords.join(" | ")}${st.known && st.variants.length > 1 ? ` (= ${st.variants.join(", ")})` : ""}` })]
        : []),
      ...(kinds.length || values.length
        ? [
            [
              kinds.map((k) => (w.lang ? eventName(factKind(k), w.lang) : factKind(k))).join("/"),
              values.length ? `${values.join(" | ")}${a?.known && a.variants.length > 1 ? ` (= ${a.variants.join(", ")})` : ""}` : "",
            ]
              .filter(Boolean)
              .join(" "),
          ]
        : []),
      ...(q.place ? [say("ui.query.place", "place {place}", { place: q.place })] : []),
      ...(q.house ? [w.lang && houseHasWord(q.house) ? q.house : say("ui.query.house", "house {house}", { house: q.house })] : []),
      ...(q.years ? [q.years.from === q.years.to ? String(q.years.from) : `${q.years.from}-${q.years.to}`] : []),
      ...(q.surname ? [say("ui.query.surname", "surname {surname}", { surname: q.surname })] : []),
      ...(q.source ? [say("ui.query.source", "source {source}", { source: q.source })] : []),
      ...(statuses.length ? [statuses.map((s) => (w.lang ? statusName(s, w.lang) : s)).join("/")] : []),
    ].join(" · ");
    const countText = (people: number, facts: number) =>
      w.lang ? ui(w.lang, "ui.query.count", { people, facts }) : `${counted(people, "person", "people")}, ${counted(facts, "fact")}`;

    const selfTerm = ui(lang, "ui.query.self");
    const term = (r: FactRow | StoryRow): string | undefined => (r.self ? selfTerm : r.relation ? relationText(r.relation, lang) : undefined);
    const generation = (r: FactRow | StoryRow): number | undefined => r.line ?? r.relation?.generation;
    const open = openOf(ctx, tree);
    const groupLabel = (key: string, labels: Map<string, string>): string => {
      if (key === "unknown") return say("ui.query.unknown", "unknown");
      if (by === "generation") return key === "side" ? say("ui.query.side", "side branches") : key;
      if (by === "decade") return `${key.slice(0, -1)}–${Number(key.slice(0, -1)) + 9}`;
      return labels.get(key) ?? key;
    };

    const relationData = (r: FactRow | StoryRow) => {
      const g = generation(r);
      return r.self
        ? { term: selfTerm, termEn: "self", generation: 1, path: [r.person.id] }
        : r.relation
          ? { term: r.relation.term[tl], termEn: r.relation.term.en, ...(r.relation.side ? { side: r.relation.side } : {}), ...(g !== undefined ? { generation: g } : {}), path: r.relation.path }
          : null;
    };
    const whoText = (r: FactRow | StoryRow): string[] => {
      const g = generation(r);
      return [`${r.person.id} ${personLabel(r.person)}`, `${term(r) ?? say("ui.query.unrelated", "not related")}${g !== undefined ? ` (G${g})` : ""}`];
    };
    const sourcesText = (list: { id: string; title: string }[]): string => {
      const shown = list.slice(0, 2).map((s) => `${s.id}${s.title ? ` ${truncate(s.title, 40)}` : ""}`);
      return shown.length ? `${shown.join(", ")}${list.length > 2 ? ` +${list.length - 2}` : ""}` : "";
    };
    const pageOf = <R extends FactRow | StoryRow>(rows: R[], grouped: { groups: { key: string; rows: R[] }[] } | undefined, groups: { key: string; label: string; people: number; facts: number }[] | undefined, text: (r: R) => string, count: (people: number, n: number) => string) => {
      const ordered = grouped ? grouped.groups.flatMap((g) => g.rows) : rows;
      const page = paginate(ordered, Math.min(ctx.limit, LIST_PAGE_MAX), ctx.page);
      const body: string[] = [];
      if (grouped) {
        const keyOf = new Map<R, string>();
        for (const g of grouped.groups) for (const r of g.rows) keyOf.set(r, g.key);
        let at: string | undefined;
        for (const r of page.items) {
          const k = keyOf.get(r)!;
          if (k !== at) {
            const g = groups!.find((x) => x.key === k)!;
            body.push(`${g.label}: ${count(g.people, g.facts)}`);
            at = k;
          }
          body.push(`  ${text(r)}`);
        }
      } else body.push(...page.items.map(text));
      return { page, body };
    };
    const tries = (word: string | undefined) => [...(word ? [`strom find ${shellArg(word)}`] : []), ...(WIDER[kin] ? [command(["--kin", WIDER[kin]!])] : [])];
    const elsewhereOf = (ids: string[], word: string | undefined) =>
      ids.length
        ? say("ui.query.elsewhere", "+{n} with the word only elsewhere (a name, a note, …): {command}", {
            n: w.lang ? ids.length : counted(ids.length, "person", "people"),
            command: `strom find ${shellArg(word!)}`,
          })
        : undefined;

    // an occupation asked for that no list knows (found only as typed), and the research's own list unreadable
    const ans = st ?? a!;
    const asked = new Set(occupations.map((o) => o.normalize("NFC").trim()));
    const notInList = st ? [] : ans.unknown.filter((x) => asked.has(x));
    const occNote = notInList.length
      ? say("ui.query.occupation.unknown", "{words}: not in the list of occupations, found only as written; its other forms: strom occupation add {word} <form> [la:<form> …]", {
          words: notInList.join(", "),
          word: shellArg(notInList[0]!),
        })
      : undefined;
    const listNote = ans.listError
      ? say("ui.occupation.unreadable", `the research's own list of occupations (${OCCUPATIONS_FILE}) cannot be read: the built-in list only — strom repair`, { file: OCCUPATIONS_FILE })
      : undefined;
    const known = { known: ans.known, ...(asked.size ? { unknown: notInList } : {}), ...(ans.listError ? { listError: ans.listError } : {}) };

    if (st) {
      const countStories = (people: number, stories: number) =>
        w.lang ? ui(w.lang, "ui.query.count.stories", { people, stories }) : `${counted(people, "person", "people")}, ${counted(stories, "story", "stories")}`;
      const storyText = (r: StoryRow): string =>
        [
          ...whoText(r),
          `${r.owner.type === "family" ? `${r.owner.id} ` : ""}${say("ui.query.story.snippet", "story: “{text}”", { text: r.snippet })}`,
          r.draft ? say("ui.query.story.draft", "draft") : "",
          r.sources.length ? (r.basis === "story" ? say("ui.query.story.all", "the story's sources: {list}", { list: sourcesText(r.sources) }) : sourcesText(r.sources)) : "",
        ]
          .filter(Boolean)
          .join(" · ");
      const storyData = (r: StoryRow) => {
        const url = open(r.person.id);
        return {
          person: { id: r.person.id, name: displayName(r.person), lifespan: lifespan(r.person) },
          relation: relationData(r),
          story: { of: r.owner.id, draft: r.draft, snippet: r.snippet, sources: r.sources, basis: r.basis },
          ...(url ? { open: url } : {}),
        };
      };
      const word = storyWords[0];
      const elsewhere = elsewhereOf(st.elsewhere, word);
      const data = {
        of: { id: of.id, name: personLabel(of) },
        kin,
        variants: st.variants,
        ...known,
        total: { people: st.people, stories: st.rows.length },
        elsewhere: { people: st.elsewhere.length, ...(st.elsewhere.length ? { ids: st.elsewhere, command: `strom find ${shellArg(word!)}` } : {}) },
      };
      if (!st.rows.length) {
        const t = tries(word);
        return {
          text: lines(
            say("ui.query.none", "nothing found: {query}", { query: `${what ? `${what} · ` : ""}${kinText}` }),
            listNote,
            elsewhere,
            t.length ? say("ui.query.try", "try: {commands}", { commands: t.join(" · ") }) : undefined,
          ),
          data: { ...data, rows: [] },
        };
      }
      const head = `${what ? `${what} · ` : ""}${kinText}: ${countStories(st.people, st.rows.length)}`;
      const grouped = by ? groupRows(st.rows, by, term) : undefined;
      const groups = grouped?.groups.map((g) => ({ key: g.key, label: groupLabel(g.key, grouped.labels), people: g.people, facts: g.facts }));
      const groupsData = groups?.map(({ facts, ...g }) => ({ ...g, stories: facts }));
      if (opts.count)
        return {
          text: lines(head, ...(groups ?? []).map((g) => `  ${g.label}: ${countStories(g.people, g.facts)}`), elsewhere, listNote),
          data: { ...data, ...(groupsData ? { groups: groupsData } : {}) },
        };
      const { page, body } = pageOf(st.rows, grouped, groups, storyText, countStories);
      return {
        text: lines(head, ...body, elsewhere, listNote, moreLine(page, command(kinArg.concat(by ? ["--by", by] : [])), w.lang)),
        data: { ...data, ...(groupsData ? { groups: groupsData } : {}), page: page.page, pages: page.pages, rows: page.items.map(storyData) },
      };
    }
    const fa = a!;
    const head = `${what ? `${what} · ` : ""}${kinText}: ${countText(fa.people, fa.rows.length)}`;

    const rowText = (r: FactRow): string => {
      const e = r.fact;
      const kind = w.lang ? eventName(e.kind, w.lang, e.label) : `${e.kind}${e.label ? ` ${e.label}` : ""}`;
      const value = [e.value, e.cause].filter(Boolean).join(", ");
      const where = w.lang ? humanPlace(e.place, e.house, w.lang) : [e.place, e.house ? `house ${e.house}` : ""].filter(Boolean).join(", ");
      return [
        ...whoText(r),
        `${e.id}${r.owner.type === "family" ? ` ${r.owner.id}` : ""} ${kind}${value ? ` ${value}` : ""}`,
        where,
        w.lang ? humanDate(e.date, w.lang) : (e.date ?? ""),
        w.lang ? statusName(e.status, w.lang) : e.status,
        sourcesText(r.sources),
      ]
        .filter(Boolean)
        .join(" · ");
    };
    const rowData = (r: FactRow) => {
      const e = r.fact;
      const url = open(r.person.id);
      return {
        person: { id: r.person.id, name: displayName(r.person), lifespan: lifespan(r.person) },
        relation: relationData(r),
        fact: {
          id: e.id,
          ...(r.owner.type === "family" ? { family: r.owner.id } : {}),
          kind: e.kind,
          ...(e.label ? { label: e.label } : {}),
          ...(e.value ? { value: e.value } : {}),
          ...(e.cause ? { cause: e.cause } : {}),
          ...(e.date ? { date: e.date } : {}),
          ...(e.place ? { place: e.place } : {}),
          ...(e.house ? { house: e.house } : {}),
          status: e.status,
          sources: r.sources,
        },
        ...(url ? { open: url } : {}),
      };
    };

    const findWord = values[0];
    const elsewhere = elsewhereOf(fa.elsewhere, findWord);
    const data = {
      of: { id: of.id, name: personLabel(of) },
      kin,
      variants: fa.variants,
      ...known,
      total: { people: fa.people, facts: fa.rows.length },
      elsewhere: { people: fa.elsewhere.length, ...(fa.elsewhere.length ? { ids: fa.elsewhere, command: `strom find ${shellArg(findWord!)}` } : {}) },
    };

    if (!fa.rows.length) {
      const t = tries(findWord);
      return {
        text: lines(
          say("ui.query.none", "nothing found: {query}", { query: `${what ? `${what} · ` : ""}${kinText}` }),
          occNote,
          listNote,
          elsewhere,
          t.length ? say("ui.query.try", "try: {commands}", { commands: t.join(" · ") }) : undefined,
        ),
        data: { ...data, rows: [] },
      };
    }

    const grouped = by ? groupRows(fa.rows, by, term) : undefined;
    const groups = grouped?.groups.map((g) => ({ key: g.key, label: groupLabel(g.key, grouped.labels), people: g.people, facts: g.facts }));
    if (opts.count) {
      return {
        text: lines(head, ...(groups ?? []).map((g) => `  ${g.label}: ${countText(g.people, g.facts)}`), elsewhere, occNote, listNote),
        data: { ...data, ...(groups ? { groups } : {}) },
      };
    }

    // the rows (by group: in the order of the groups), a page at a time
    const { page, body } = pageOf(fa.rows, grouped, groups, rowText, countText);
    return {
      text: lines(head, ...body, elsewhere, occNote, listNote, moreLine(page, command(kinArg.concat(by ? ["--by", by] : [])), w.lang)),
      data: { ...data, ...(groups ? { groups } : {}), page: page.page, pages: page.pages, rows: page.items.map(rowData) },
    };
  },
});

/** An English text with its values (the agent's words; a person's come from the catalog). */
function fillEn(text: string, params: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/gu, (m, k: string) => (k in params ? String(params[k]) : m));
}
