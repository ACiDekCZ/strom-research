// strom house: the houses of a family tree (spec 030 "the history of a house") — the list, one house whole, a house
// made by the person, what the agent writes of a house item by item, what the person confirms of it, and a research of
// a house the person made themselves taken in (core/houses.ts, core/houseimport.ts).

import fs from "node:fs";
import path from "node:path";
import { register, type CommandDef, type OptionDef } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, table, truncate } from "../cli/format.ts";
import { ui } from "../cli/ui.ts";
import { UsageError } from "../core/errors.ts";
import {
  HOUSE_CERTAINTIES,
  HOUSE_EVENT_KINDS,
  HOUSE_HOLDER_HOWS,
  HOUSE_LOCATION_HOWS,
  HOUSE_MAP_KINDS,
  HOUSE_NUMBER_CERTAINTIES,
  HOUSE_RESIDENT_ROLES,
  type House,
  type HouseOrigin,
  type Input,
  type Task,
} from "../core/model.ts";
import {
  addHouse,
  addHouseItem,
  confirmHouse,
  findHouse,
  findTown,
  houseRows,
  houseSources,
  houseView,
  listRow,
  recordOf,
  setHouse,
  type HouseConfirm,
  type HouseRow,
} from "../core/houses.ts";
import { ImportQuestions, planImport, writeImport, type ImportQuestion } from "../core/houseimport.ts";
import { create, listOpt, normId, update } from "../core/records.ts";
import { isAgent } from "../core/which.ts";
import type { Tree } from "../core/tree.ts";

function oneOf<T extends string>(v: unknown, allowed: readonly T[], name: string): T {
  if (!allowed.includes(v as T)) throw new UsageError(`${v === undefined ? "missing" : "invalid"} --${name}${v === undefined ? "" : ` "${String(v)}"`}`, { code: "house.body", hint: allowed.join(", ") });
  return v as T;
}
const maybe = <T extends string>(v: unknown, allowed: readonly T[], name: string): T | undefined => (v === undefined ? undefined : oneOf(v, allowed, name));
const text = (v: unknown, name: string, max: number): string => {
  const s = typeof v === "string" ? v.normalize("NFC").trim() : "";
  if (!s) throw new UsageError(`missing --${name}`, { code: "house.body" });
  if (s.length > max) throw new UsageError(`--${name} is longer than ${max} characters`, { code: "house.body" });
  return s;
};
const opt = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.normalize("NFC").trim() : undefined);

/** The state of a house in the research language. */
const stateWord = (lang: string, s: HouseRow["state"]) => ui(lang, `ui.house.state.${s}`);

// ── list and show ───────────────────────────────────────────────────────────────────────────────────────────────

function showText(tree: Tree, row: HouseRow, v: Record<string, unknown>): string {
  const lang = tree.lang;
  const h = row.record ? tree.get<House>(row.record.id) : undefined;
  const src = (s: { source?: string; page?: string; url?: string }[] | undefined) => (s?.length ? ` [${s.map((x) => [x.source, x.page, x.url].filter(Boolean).join(" ")).join("; ")}]` : "");
  const span = (x: { from?: string; to?: string }) => (x.from || x.to ? ` ${x.from ?? ""}–${x.to ?? ""}` : "");
  const by = (o: HouseOrigin) => (o === "research" ? "" : ` (${ui(lang, `ui.house.origin.${o}`)})`);
  const part = (key: Parameters<typeof ui>[1], items: string[]) => (items.length ? [ui(lang, key), ...items.map((x) => `  ${x}`)].join("\n") : undefined);
  const head = `${row.id ? `${row.id} ` : ""}${row.place.name} ${row.house}${row.name ? ` „${row.name}“` : ""} — ${stateWord(lang, row.state)}${row.task ? ` ${row.task}` : ""}`;
  const people = row.tree ? [...row.tree.persons].sort() : [];
  return lines(
    head,
    `${ui(lang, "ui.house.key")}: ${row.key}`,
    people.length ? `${ui(lang, "ui.house.persons")}: ${people.join(", ")}${row.years ? ` (${row.years.from === row.years.to ? row.years.from : `${row.years.from}–${row.years.to}`})` : ""}` : undefined,
    row.question ? `${ui(lang, "ui.house.question")}: ${row.question.id} ${row.question.text}` : undefined,
    part("ui.house.numbers", (h?.numbers ?? []).filter((n) => !n.notSame).map((n) => `${n.id} ${n.number}${span(n)} · ${n.certainty}${n.proposed ? ` · ${ui(lang, n.confirmed ? "ui.house.confirmed" : "ui.house.proposed")}` : ""}${n.text ? ` — ${n.text}` : ""}${src(n.sources)}${by(n.origin)}`)),
    h?.location
      ? part("ui.house.location", [`${h.location.lat}, ${h.location.lon} · ${h.location.how} · ${h.location.certainty}${h.location.confirmed ? ` · ${ui(lang, "ui.house.confirmed")} ${h.location.confirmed}` : ""}${src(h.location.sources)}${by(h.location.origin)}`])
      : undefined,
    part("ui.house.timeline", (h?.timeline ?? []).map((e) => `${e.id} ${e.date ?? "?"} ${e.kind}: ${e.text} · ${e.certainty}${h?.sensitive?.includes(e.id) ? ` · ${ui(lang, "ui.house.sensitive")}` : ""}${src(e.sources)}${by(e.origin)}`)),
    part("ui.house.holders", (h?.holders ?? []).map((x) => `${x.id} ${x.name}${x.person ? ` (${x.person})` : ""}${span(x)} · ${x.how} · ${x.certainty}${src(x.sources)}${by(x.origin)}`)),
    part("ui.house.residents", (h?.residents ?? []).map((x) => `${x.id} ${x.name}${x.person ? ` (${x.person})` : ""} · ${x.role}${span(x)}${x.certainty ? ` · ${x.certainty}` : ""}${src(x.sources)}${by(x.origin)}`)),
    h?.look ? part("ui.house.look", [`${h.look.text} · ${h.look.certainty}${(h.look.images ?? []).map((i) => ` [${[i.url, i.file, i.license].filter(Boolean).join(" ")}]`).join("")}`]) : undefined,
    part("ui.house.maps", (h?.maps ?? []).map((m) => `${m.id} ${m.kind}${m.label ? ` ${m.label}` : ""}${m.sheet ? ` (${m.sheet})` : ""}${m.url ? ` ${m.url}` : ""}${m.manual ? ` · ${ui(lang, "ui.house.byhand")}` : ""}`)),
    part("ui.house.passed", (h?.passed ?? []).map((p) => `${p.id} ${p.what}${p.source ? ` ${p.source}` : ""}${p.url ? ` ${p.url}` : ""}${p.found === true ? ` · ${ui(lang, "ui.house.found")}` : p.found === false ? ` · ${ui(lang, "ui.house.notfound")}` : ""}${by(p.origin)}`)),
    part("ui.house.manual", (h?.manual ?? []).map((m) => `${m.id} ${m.what}${m.url ? ` ${m.url}` : ""}${m.why ? ` (${m.why})` : ""}${by(m.origin)}`)),
    part("ui.house.unknown", (h?.unknown ?? []).map((u) => `${u.id} ${u.text}${u.question ? ` (${u.question})` : ""}`)),
    part("ui.house.archiveOnly", (h?.archiveOnly ?? []).map((a) => `${a.id} ${[a.archive, a.fond, a.signature].filter(Boolean).join(", ")}${a.what ? ` — ${a.what}` : ""}${a.url ? ` ${a.url}` : ""}`)),
    part("ui.house.materials", ((v.materials as { id: string; title: string; kind: string }[]) ?? []).map((m) => `${m.id} ${m.title}${m.kind === "own-research" ? ` (${ui(lang, "ui.house.ownresearch")})` : ""}`)),
    h && !h.timeline.length && !h.holders.length && !h.residents.length && !h.numbers.length ? ui(lang, "ui.house.empty") : !h ? ui(lang, "ui.house.empty") : undefined,
  );
}

register(
  {
    path: ["house", "list"],
    summary: "The houses of the family tree: those the research has a record of (A…) and those the facts name",
    group: "sources",
    tree: true,
    description: [
      "Every house of the research, one row each by its key (the one the Strom app computes: <municipality>|<number>):",
      "the research's records (A…) and the houses the tree's facts give a house number at; with how many people of the",
      "tree lived there, which years, and where its research is: none, queued, running, waiting (a question to the",
      "person), held (put aside), done.",
    ].join("\n"),
    options: [{ name: "town", type: "string", value: "<L…|name>", description: "only the houses of this municipality (its place record)" }],
    examples: ["strom house list", "strom house list --town L0001 --json"],
    run(ctx, { opts }) {
      const tree = ctx.tree();
      const town = opt(opts.town) ? findTown(tree, opt(opts.town)!).id : undefined;
      const rows = houseRows(tree, town ? { town } : {});
      const lang = tree.lang;
      return {
        text: rows.length
          ? table(
              rows.map((r) => [r.id ?? "", r.place.name, r.house, r.name ?? "", String(r.persons), r.years ? (r.years.from === r.years.to ? String(r.years.from) : `${r.years.from}–${r.years.to}`) : "", `${stateWord(lang, r.state)}${r.task ? ` ${r.task}` : ""}`]),
              { header: ui(lang, "ui.house.head").split("|") },
            )
          : ui(lang, "ui.house.none"),
        data: { houses: rows.map(listRow) },
      };
    },
  },
  {
    path: ["house", "show"],
    summary: "One house whole: its numbers in time, point, timeline, holders, residents, what was gone through, material",
    group: "sources",
    tree: true,
    args: [{ name: "house", description: "A…, its key (town|number), or its municipality and number (L… 16, Lhota 16)", required: true, variadic: true }],
    examples: ["strom house show A0001", 'strom house show "lhota|16" --json', "strom house show L0001 16"],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const row = findHouse(tree, args.join(" "));
      const v = houseView(tree, row);
      return { text: showText(tree, row, v), data: { house: v } };
    },
  },
  {
    path: ["house", "add"],
    summary: "Make a house record of a municipality and a number (the person's: listed although nobody of the tree lived there)",
    group: "sources",
    tree: true,
    writes: true,
    description: [
      "Makes the research's record of a house (A…). The municipality is its place record (L…) or the one place of that",
      "name; the number as written (\"16\", \"Dlouhá 12\", \"13/2\"). A municipality of two or more words in quotes.",
      "What the research finds of a house is written by the item commands: strom house add event|holder|resident|",
      "number|location|passed|manual|unknown|archive-only|look|map|material|name <house> … — a house of the tree's facts",
      "gets its record by the first of them.",
    ].join("\n"),
    args: [
      { name: "town", description: "the municipality: L… or its name", required: true },
      { name: "number", description: "the house number as written", required: true, variadic: true },
    ],
    options: [{ name: "name", type: "string", value: "<name>", description: "the house's name after a family (\"U Lhotáků\")", max: 200 }],
    examples: ["strom house add L0001 16", 'strom house add "Nová Lhota" 12 --name "U Lhotáků"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const place = findTown(tree, args[0]!);
      const agent = isAgent(ctx.env);
      const h = addHouse(tree, place, args.slice(1).join(" "), { ...(opt(opts.name) ? { name: opt(opts.name)!, nameBy: agent ? "research" : "user" } : {}), byUser: !agent });
      return { text: lines(...tree.written.map((o) => o.summary), `house ${h.id}: ${place.names[0]?.name ?? place.id} ${h.house}`), data: { house: houseView(tree, findHouse(tree, h.id)) } };
    },
  },
);

// ── the items ───────────────────────────────────────────────────────────────────────────────────────────────────

const SOURCE_OPTIONS: OptionDef[] = [
  { name: "source", type: "string", value: "<S…>", aliases: ["cite"], description: "the source of the research it is from" },
  { name: "locator", type: "string", value: "<where>", description: "where in the source: folio, page, entry (with --source)", max: 200 },
  { name: "url", type: "string", value: "<address>", description: "a web address it is from (a chronicle, a map, an article)" },
  { name: "from", type: "string", value: "<I…>", description: "the material it was read from: a research of the person's own taken in (origin import)" },
];
const CERTAINTY: OptionDef = { name: "certainty", type: "string", value: "<level>", description: `${HOUSE_CERTAINTIES.join(", ")} (default medium)` };

/** Who writes an item: the material of the person's own research (--from), the person at a terminal, the research. */
function originOf(ctx: Context, tree: Tree, opts: Record<string, unknown>): { origin: HouseOrigin; material?: string } {
  const from = opt(opts.from);
  if (from) {
    const id = normId(from, "input");
    const i = tree.get<Input>(id);
    if (!i) throw new UsageError(`no material ${id}`, { code: "house.body", hint: "strom input list" });
    return { origin: "import", material: id };
  }
  return { origin: isAgent(ctx.env) ? "research" : "user" };
}

/** The house the item goes to: its record, made for a house of the tree's facts by the first item. */
function target(tree: Tree, ref: string[]): House {
  return recordOf(tree, findHouse(tree, ref.join(" ")));
}

type ItemRun = (ctx: Context, tree: Tree, h: House, opts: Record<string, unknown>) => { id?: string; what: string };

function itemCommand(kind: string, summary: string, options: OptionDef[], examples: string[], run: ItemRun, description?: string): CommandDef {
  return {
    path: ["house", "add", kind],
    summary,
    group: "sources",
    tree: true,
    writes: true,
    ...(description ? { description } : {}),
    args: [{ name: "house", description: "A…, its key (town|number), or its municipality and number", required: true, variadic: true }],
    options,
    examples,
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const out = tree.withTreeLock(() => {
        const h = target(tree, args);
        const r = run(ctx, tree, h, opts);
        return { h, ...r };
      });
      const v = houseView(tree, findHouse(tree, out.h.id));
      return {
        text: lines(...tree.written.map((o) => o.summary), out.id ? `${out.id} written to ${out.h.id} (${out.what})` : `${out.h.id}: ${out.what}`),
        data: { house: out.h.id, ...(out.id ? { item: out.id } : {}), view: v },
      };
    },
  };
}

const sources = (tree: Tree, opts: Record<string, unknown>) => houseSources(tree, { ...(opt(opts.source) ? { source: opt(opts.source)! } : {}), ...(opt(opts.locator) ? { page: opt(opts.locator)! } : {}), ...(opt(opts.url) ? { url: opt(opts.url)! } : {}) });
const certainty = (opts: Record<string, unknown>) => maybe(opts.certainty, HOUSE_CERTAINTIES, "certainty") ?? "medium";
const person = (tree: Tree, v: unknown): string | undefined => {
  const p = opt(v);
  if (!p) return undefined;
  const id = normId(p, "person");
  if (!tree.get(id)) throw new UsageError(`no person ${id}`, { code: "house.body", hint: "strom person find <name>" });
  return id;
};
const span = (opts: Record<string, unknown>) => ({ ...(opt(opts.since) ? { from: opt(opts.since)! } : {}), ...(opt(opts.until) ? { to: opt(opts.until)! } : {}) });
const SPAN: OptionDef[] = [
  { name: "since", type: "string", value: "<year>", description: "from when (a year, a year and month: 1858, 1868-05)", max: 40 },
  { name: "until", type: "string", value: "<year>", description: "until when", max: 40 },
];

register(
  itemCommand(
    "event",
    "Write what happened to a house: built, rebuilt, a fire, a flood, a transfer, a renumbering, demolished, an auction",
    [
      { name: "kind", type: "string", value: "<kind>", description: HOUSE_EVENT_KINDS.join(", ") },
      { name: "date", type: "string", value: "<date>", description: "when: a year, a year and month, a day (1781, 1868-05)", max: 40 },
      { name: "text", type: "string", value: "<text>", description: "what happened, in the research language", max: 1000 },
      CERTAINTY,
      { name: "sensitive", type: "boolean", description: "of the 20th century and sensitive (a confiscation, an expulsion): shared outputs hide it" },
      ...SOURCE_OPTIONS,
    ],
    ['strom house add event A0001 --kind fire --date 1868-05 --text "<what the chronicle says>" --certainty medium --url https://example.org/chronicle', "strom house add event A0001 --kind transfer --date 1781 --text \"<who bought it>\" --source S0001 --locator \"fol. 12\" --certainty high"],
    (ctx, tree, h, opts) => {
      const o = originOf(ctx, tree, opts);
      const { house, id } = addHouseItem(tree, h.id, "timeline", {
        kind: oneOf(opts.kind, HOUSE_EVENT_KINDS, "kind"),
        ...(opt(opts.date) ? { date: opt(opts.date)! } : {}),
        text: text(opts.text, "text", 1000),
        certainty: certainty(opts),
        ...(sources(tree, opts) ? { sources: sources(tree, opts)! } : {}),
        ...(o.material ? { material: o.material } : {}),
        origin: o.origin,
      }, "event");
      if (opts.sensitive === true) setHouse(tree, house.id, (x) => void (x.sensitive = [...(x.sensitive ?? []), id]), `${id} sensitive`);
      return { id, what: String(opts.kind) };
    },
  ),
  itemCommand(
    "holder",
    "Write who held a house, when, and how it came to them",
    [
      { name: "name", type: "string", value: "<name>", description: "the holder as the record names them", max: 200 },
      { name: "person", type: "string", value: "<P…>", description: "the person of the tree, where it is one (people off the tree only named)" },
      ...SPAN,
      { name: "how", type: "string", value: "<how>", description: HOUSE_HOLDER_HOWS.join(", ") },
      CERTAINTY,
      ...SOURCE_OPTIONS,
    ],
    ['strom house add holder A0001 --name "<holder>" --person P0001 --since 1858 --until 1890 --how marriage --source S0001 --certainty high'],
    (ctx, tree, h, opts) => {
      const p = person(tree, opts.person);
      const { id } = addHouseItem(tree, h.id, "holders", {
        name: text(opts.name, "name", 200),
        ...(p ? { person: p } : {}),
        ...span(opts),
        how: oneOf(opts.how ?? "other", HOUSE_HOLDER_HOWS, "how"),
        certainty: certainty(opts),
        ...(sources(tree, opts) ? { sources: sources(tree, opts)! } : {}),
        origin: originOf(ctx, tree, opts).origin,
      }, "holder");
      return { id, what: text(opts.name, "name", 200) };
    },
  ),
  itemCommand(
    "resident",
    "Write who lived in a house and as what: farmer, retired, lodger, servant, tenant",
    [
      { name: "name", type: "string", value: "<name>", description: "the resident as the record names them", max: 200 },
      { name: "person", type: "string", value: "<P…>", description: "the person of the tree, where it is one" },
      { name: "role", type: "string", value: "<role>", description: HOUSE_RESIDENT_ROLES.join(", ") },
      ...SPAN,
      CERTAINTY,
      ...SOURCE_OPTIONS,
    ],
    ['strom house add resident A0001 --name "<resident>" --role lodger --since 1880 --until 1880 --source S0001'],
    (ctx, tree, h, opts) => {
      const p = person(tree, opts.person);
      const { id } = addHouseItem(tree, h.id, "residents", {
        name: text(opts.name, "name", 200),
        ...(p ? { person: p } : {}),
        role: oneOf(opts.role ?? "other", HOUSE_RESIDENT_ROLES, "role"),
        ...span(opts),
        ...(opts.certainty !== undefined ? { certainty: certainty(opts) } : {}),
        ...(sources(tree, opts) ? { sources: sources(tree, opts)! } : {}),
        origin: originOf(ctx, tree, opts).origin,
      }, "resident");
      return { id, what: text(opts.name, "name", 200) };
    },
  ),
  itemCommand(
    "number",
    "Write a number the house had and when; a renumbering the research only proposes (--proposed) waits for the person",
    [
      { name: "number", type: "string", value: "<no.>", description: "the number as written then", max: 100 },
      ...SPAN,
      { name: "certainty", type: "string", value: "<level>", description: `${HOUSE_NUMBER_CERTAINTIES.join(", ")} (default medium; proposed: probable)` },
      { name: "proposed", type: "boolean", description: "the same family under two numbers: a renumbering the person confirms (strom house confirm)" },
      { name: "text", type: "string", value: "<text>", description: "why: what shows it is the same house", max: 1000 },
      ...SOURCE_OPTIONS,
    ],
    ['strom house add number A0001 --number 9 --until 1850 --proposed --text "<the same family under no. 9 and no. 16>" --source S0001'],
    (ctx, tree, h, opts) => {
      const proposed = opts.proposed === true;
      const { id } = addHouseItem(tree, h.id, "numbers", {
        number: text(opts.number, "number", 100),
        ...span(opts),
        certainty: maybe(opts.certainty, HOUSE_NUMBER_CERTAINTIES, "certainty") ?? (proposed ? "probable" : "medium"),
        ...(proposed ? { proposed: true as const } : {}),
        ...(opt(opts.text) ? { text: opt(opts.text)! } : {}),
        ...(sources(tree, opts) ? { sources: sources(tree, opts)! } : {}),
        origin: originOf(ctx, tree, opts).origin,
      }, "number");
      return { id, what: `no. ${String(opts.number)}${proposed ? ", proposed: the person confirms it" : ""}` };
    },
  ),
  itemCommand(
    "location",
    "Put the house on the map: its point, how it was found, how sure",
    [
      { name: "lat", type: "string", value: "<deg>", description: "latitude (49.61)" },
      { name: "lon", type: "string", value: "<deg>", description: "longitude (15.12)" },
      { name: "how", type: "string", value: "<how>", description: HOUSE_LOCATION_HOWS.join(", ") },
      CERTAINTY,
      ...SOURCE_OPTIONS,
    ],
    ["strom house add location A0001 --lat 49.61 --lon 15.12 --how today-number --certainty high --url https://example.org/map"],
    (ctx, tree, h, opts) => {
      const lat = Number(opts.lat);
      const lon = Number(opts.lon);
      if (opts.lat === undefined || opts.lon === undefined || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)
        throw new UsageError("--lat (±90) and --lon (±180) in degrees", { code: "house.body" });
      if (h.location?.confirmed) throw new UsageError(`the person confirmed the point of ${h.id}: it stays`, { code: "house.confirmed", hint: `strom house show ${h.id}` });
      const s = sources(tree, opts);
      setHouse(tree, h.id, (x) => void (x.location = { lat, lon, how: oneOf(opts.how ?? "other", HOUSE_LOCATION_HOWS, "how"), certainty: certainty(opts), origin: originOf(ctx, tree, opts).origin, ...(s ? { sources: s } : {}) }), `point ${lat} ${lon}`);
      return { what: `point ${lat}, ${lon}` };
    },
  ),
  itemCommand(
    "passed",
    "Write what was gone through for the house, found or not: a later task never goes through it again",
    [
      { name: "what", type: "string", value: "<text>", description: "what was gone through (a register and its years, a chronicle)", max: 1000 },
      { name: "found", type: "string", value: "<yes|no>", description: "whether it said something of the house" },
      { name: "source", type: "string", value: "<S…>", description: "the source gone through" },
      { name: "url", type: "string", value: "<address>", description: "the address gone through" },
      { name: "from", type: "string", value: "<I…>", description: "the material that says it was gone through (origin import)" },
    ],
    ['strom house add passed A0001 --what "<register and its years, entries with no. 16>" --source S0001 --found yes'],
    (ctx, tree, h, opts) => {
      const found = opts.found === undefined ? undefined : oneOf(opts.found, ["yes", "no"] as const, "found") === "yes";
      const src = opt(opts.source) ? normId(opt(opts.source)!, "source") : undefined;
      if (src && !tree.get(src)) throw new UsageError(`no source ${src}`, { code: "house.body" });
      if (opt(opts.url) && !/^https?:\/\//iu.test(opt(opts.url)!)) throw new UsageError(`"${opt(opts.url)}" is no web address`, { code: "house.body" });
      const { id } = addHouseItem(tree, h.id, "passed", { what: text(opts.what, "what", 1000), ...(src ? { source: src } : {}), ...(opt(opts.url) ? { url: opt(opts.url)! } : {}), ...(found !== undefined ? { found } : {}), origin: originOf(ctx, tree, opts).origin }, "gone through");
      return { id, what: "gone through" };
    },
  ),
  itemCommand(
    "manual",
    "Write a link to be gone through by hand (a site that refuses automated reading): never taken for gone through",
    [
      { name: "what", type: "string", value: "<text>", description: "what it is", max: 1000 },
      { name: "url", type: "string", value: "<address>", description: "its address" },
      { name: "why", type: "string", value: "<text>", description: "why by hand", max: 500 },
      { name: "from", type: "string", value: "<I…>", description: "the material that says so (origin import)" },
    ],
    ['strom house add manual A0001 --what "<cadastral map sheet>" --url https://example.org/sheet --why "<the site refuses automated reading>"'],
    (ctx, tree, h, opts) => {
      const { id } = addHouseItem(tree, h.id, "manual", { what: text(opts.what, "what", 1000), ...(opt(opts.url) ? { url: opt(opts.url)! } : {}), ...(opt(opts.why) ? { why: opt(opts.why)! } : {}), origin: originOf(ctx, tree, opts).origin }, "by hand");
      return { id, what: "by hand" };
    },
  ),
  itemCommand(
    "unknown",
    "Write what is not known of the house: an open question, a disputed reading",
    [
      { name: "text", type: "string", value: "<text>", description: "the question, in the research language", max: 1000 },
      { name: "question", type: "string", value: "<T…>", description: "the task asking the person, where there is one" },
      { name: "from", type: "string", value: "<I…>", description: "the material that says so (origin import)" },
    ],
    ['strom house add unknown A0001 --text "<who held the house 1856–1858?>"'],
    (ctx, tree, h, opts) => {
      const q = opt(opts.question) ? normId(opt(opts.question)!, "task") : undefined;
      if (q && !tree.get<Task>(q)) throw new UsageError(`no task ${q}`, { code: "house.body" });
      const { id } = addHouseItem(tree, h.id, "unknown", { text: text(opts.text, "text", 1000), ...(q ? { question: q } : {}), origin: originOf(ctx, tree, opts).origin }, "not known");
      return { id, what: "not known" };
    },
  ),
  itemCommand(
    "archive-only",
    "Write what is only in an archive's reading room: the archive, the fonds, the call number",
    [
      { name: "archive", type: "string", value: "<name>", description: "the archive", max: 300 },
      { name: "fond", type: "string", value: "<name>", description: "the fonds", max: 300 },
      { name: "signature", type: "string", value: "<no.>", description: "the call number", max: 200 },
      { name: "what", type: "string", value: "<text>", description: "what is there (a land register)", max: 1000 },
      { name: "url", type: "string", value: "<address>", description: "its record online, where there is one" },
      { name: "from", type: "string", value: "<I…>", description: "the material that says so (origin import)" },
    ],
    ['strom house add archive-only A0001 --archive "<district archive>" --fond "<district court>" --signature "<book 12>" --what "<land register>"'],
    (ctx, tree, h, opts) => {
      const { id } = addHouseItem(tree, h.id, "archiveOnly", {
        archive: text(opts.archive, "archive", 300),
        ...(opt(opts.fond) ? { fond: opt(opts.fond)! } : {}),
        ...(opt(opts.signature) ? { signature: opt(opts.signature)! } : {}),
        ...(opt(opts.what) ? { what: opt(opts.what)! } : {}),
        ...(opt(opts.url) ? { url: opt(opts.url)! } : {}),
        origin: originOf(ctx, tree, opts).origin,
      }, "reading room only");
      return { id, what: "reading room only" };
    },
  ),
  itemCommand(
    "look",
    "Write what the house looked like, and its pictures (an address with its licence, or a material I…)",
    [
      { name: "text", type: "string", value: "<text>", description: "what it looked like", max: 2000 },
      CERTAINTY,
      { name: "image", type: "string", multiple: true, value: "<address|I…>", description: "a picture of it: its address, or the material (repeatable)" },
      { name: "license", type: "string", value: "<licence>", description: "the licence of the pictures by address (CC BY 4.0)", max: 200 },
      { name: "credit", type: "string", value: "<text>", description: "whose they are", max: 300 },
      { name: "from", type: "string", value: "<I…>", description: "the material that says so (origin import)" },
    ],
    ['strom house add look A0001 --text "<a ground-floor house, its gable to the green>" --certainty guess --image https://example.org/photo --license "CC BY 4.0"'],
    (ctx, tree, h, opts) => {
      const images = listOpt(opts.image).map((x) => {
        if (/^[Ii]\d+$/u.test(x)) {
          const id = normId(x, "input");
          if (!tree.get(id)) throw new UsageError(`no material ${id}`, { code: "house.body" });
          return { file: id };
        }
        if (!/^https?:\/\//iu.test(x)) throw new UsageError(`"${x}" is neither an address nor a material I…`, { code: "house.body" });
        return { url: x, ...(opt(opts.license) ? { license: opt(opts.license)! } : {}), ...(opt(opts.credit) ? { credit: opt(opts.credit)! } : {}) };
      });
      setHouse(tree, h.id, (x) => void (x.look = { text: text(opts.text, "text", 2000), certainty: certainty(opts), ...(images.length ? { images } : {}), origin: originOf(ctx, tree, opts).origin }), "look");
      return { what: "look" };
    },
  ),
  itemCommand(
    "map",
    "Write a map of the house: the cadastre, a military survey, an orthophoto — or a link to open by hand",
    [
      { name: "kind", type: "string", value: "<kind>", description: HOUSE_MAP_KINDS.join(", ") },
      { name: "url", type: "string", value: "<address>", description: "its address" },
      { name: "manual", type: "boolean", description: "only a link to open by hand (a site that refuses automated reading)" },
      { name: "sheet", type: "string", value: "<sheet>", description: "its sheet", max: 200 },
      { name: "label", type: "string", value: "<text>", description: "what it is", max: 300 },
    ],
    ['strom house add map A0001 --kind cadastre --url https://example.org/sheet --manual --sheet "<sheet 3>"'],
    (ctx, tree, h, opts) => {
      if (opt(opts.url) && !/^https?:\/\//iu.test(opt(opts.url)!)) throw new UsageError(`"${opt(opts.url)}" is no web address`, { code: "house.body" });
      const { id } = addHouseItem(tree, h.id, "maps", {
        kind: oneOf(opts.kind, HOUSE_MAP_KINDS, "kind"),
        ...(opt(opts.url) ? { url: opt(opts.url)! } : {}),
        ...(opts.manual === true ? { manual: true as const } : {}),
        ...(opt(opts.sheet) ? { sheet: opt(opts.sheet)! } : {}),
        ...(opt(opts.label) ? { label: opt(opts.label)! } : {}),
        origin: originOf(ctx, tree, opts).origin,
      }, "map");
      return { id, what: String(opts.kind) };
    },
  ),
  itemCommand(
    "material",
    "Make a material of the research (I…) one of the house's — a photo of it, a document of it — or write down a memory of it the person told; no task",
    [
      { name: "input", type: "string", multiple: true, value: "<I…>", description: "the material (repeatable)" },
      { name: "memory", type: "string", value: "<text>", description: "a memory of the house as told (a material of its own)", max: 20000 },
      { name: "witness", type: "string", value: "<name>", description: "who told the memory (kept only with --witness-consent)", max: 200 },
      { name: "witness-consent", type: "boolean", description: "the witness agreed to be named" },
    ],
    ["strom house add material A0001 --input I0003", 'strom house add material A0001 --memory "<what the family remembers of the house>"'],
    (ctx, tree, h, opts) => {
      const ids = listOpt(opts.input).map((x) => normId(x, "input"));
      const memory = opt(opts.memory);
      if (!ids.length && !memory) throw new UsageError("missing --input <I…> or --memory <text>", { code: "house.body", hint: "strom input list" });
      for (const id of ids) {
        const i = tree.get<Input>(id);
        if (!i || i.type !== "input") throw new UsageError(`no material ${id}`, { code: "house.body" });
        if (!(i.houses ?? []).includes(h.id)) update<Input>(tree, id, "input", (x) => ({ ...x, houses: [...(x.houses ?? []), h.id] }), { op: "input.houses", summary: `${id} of ${h.id}`, targets: [h.id] });
      }
      if (!memory) return { what: `material ${ids.join(", ")}` };
      if (memory.length > 20000) throw new UsageError("--memory is longer than 20000 characters", { code: "house.body" });
      // the witness's name only with their consent (spec 030 §2.7)
      const witness = opts["witness-consent"] === true ? opt(opts.witness) : undefined;
      const i = create<Input>(
        tree,
        "input",
        { name: truncate(memory, 60), text: memory, kind: "text", state: "new", from: isAgent(ctx.env) ? "research" : "user", houses: [h.id], ...(witness ? { witness } : {}) },
        (iid) => `+${iid} input text, a memory of ${h.id}`,
      );
      return { id: i.id, what: `material ${[...ids, i.id].join(", ")}` };
    },
  ),
  itemCommand(
    "name",
    "Write the house's name after a family (the person's name of it is never changed by the research)",
    [
      { name: "name", type: "string", value: "<name>", description: "the name (\"U Lhotáků\")", max: 200 },
      { name: "from", type: "string", value: "<I…>", description: "the material that names it (origin import)" },
    ],
    ['strom house add name A0001 --name "<the name after the family>"'],
    (ctx, tree, h, opts) => {
      const o = originOf(ctx, tree, opts);
      const by = o.origin === "import" ? "import" : o.origin === "user" ? "user" : "research";
      if (h.nameBy === "user" && by !== "user") throw new UsageError(`the person named ${h.id} "${h.name}": the name stays`, { code: "house.confirmed" });
      const name = text(opts.name, "name", 200);
      setHouse(tree, h.id, (x) => {
        x.name = name;
        x.nameBy = by;
      }, `name "${name}"`);
      return { what: `name "${name}"` };
    },
  ),
);

// ── what the person confirms ────────────────────────────────────────────────────────────────────────────────────

const CONFIRM_WORDS: Record<string, HouseConfirm> = { renumber: "renumber", location: "location", "not-same": "notSame" };

register({
  path: ["house", "confirm"],
  summary: "The person's word on a house: a renumbering holds, its point is right (or where it is), a number is another house",
  group: "sources",
  tree: true,
  writes: true,
  person: "Confirming a house's renumbering or point is the person's own judgment: the Strom app or their terminal, never an agent",
  description: [
    "renumber <n…>: the renumbering the research proposed holds (the number's item, strom house show);",
    "not-same <n…>: the number proposed is another house — never proposed again;",
    "location [--lat --lon]: the house's point is right, or where it is (the person's point wins over the research's).",
  ].join("\n"),
  args: [
    { name: "house", description: "A…, its key, or its municipality and number", required: true },
    { name: "what", description: "renumber, location or not-same", required: true },
    { name: "item", description: "the number's item (n…), for renumber and not-same" },
  ],
  options: [
    { name: "lat", type: "string", value: "<deg>", description: "the point's latitude (location)" },
    { name: "lon", type: "string", value: "<deg>", description: "the point's longitude (location)" },
  ],
  examples: ["strom house confirm A0001 renumber n2", "strom house confirm A0001 location --lat 49.61 --lon 15.12"],
  run(ctx, { args, opts }) {
    const tree = ctx.tree();
    const what = CONFIRM_WORDS[args[1] ?? ""];
    if (!what) throw new UsageError(`"${args[1] ?? ""}" is none of renumber, location, not-same`, { code: "house.body" });
    const set = ["strom", "house", "confirm", ...args].join(" ");
    // the person's, at their terminal or in the Strom app (the bridge, POST /houses/confirm): nobody to ask anywhere
    // else — exit 4, never decided for them
    if (ctx.env.STROM_FOR_APP !== "1" || isAgent(ctx.env)) ctx.requireHuman("Confirming a house's renumbering or point is the person's own judgment", set, "house", undefined, { window: false });
    const row = findHouse(tree, args[0]!);
    if (!row.id) throw new UsageError(`nothing to confirm of "${row.key}": the research has no record of it yet`, { code: "house.unknown" });
    const lat = opts.lat === undefined ? undefined : Number(opts.lat);
    const lon = opts.lon === undefined ? undefined : Number(opts.lon);
    const h = confirmHouse(tree, row.id, what, { ...(args[2] ? { id: args[2] } : {}), ...(lat !== undefined ? { lat } : {}), ...(lon !== undefined ? { lon } : {}) });
    return { text: lines(...tree.written.map((o) => o.summary)), data: { house: houseView(tree, findHouse(tree, h.id)) } };
  },
});

// ── a research of the person's own ──────────────────────────────────────────────────────────────────────────────

/** Ask the questions at a terminal: the person's answer as --house or --skip. */
async function askQuestions(ctx: Context, tree: Tree, questions: ImportQuestion[]): Promise<{ assign: { file: string; house: string }[]; skip: string[] }> {
  const lang = tree.lang;
  const out = { assign: [] as { file: string; house: string }[], skip: [] as string[] };
  for (const q of questions) {
    const head =
      q.why === "town-unknown" || q.why === "town-not-a-place"
        ? ui(lang, "ui.house.import.ask.town", { name: q.name, town: q.town })
        : ui(lang, q.why === "town-ambiguous" ? "ui.house.import.ask.towns" : "ui.house.import.ask.house", { name: q.name, town: q.town, number: q.number ?? "" });
    const choices = [...q.candidates.map((c) => ({ label: c.make ? ui(lang, "ui.house.import.make", { house: c.label }) : c.label })), { label: ui(lang, "ui.house.import.skip") }];
    const i = await ctx.choose(head, choices, choices.length - 1);
    const c = i === undefined ? undefined : q.candidates[i];
    if (c) out.assign.push({ file: q.file, house: c.house });
    else out.skip.push(q.file);
  }
  return out;
}

register({
  path: ["house", "import"],
  summary: "Take in a research of a house the person made themselves: kept as material of its houses, a task to take it over",
  group: "inputs",
  tree: true,
  writes: true,
  description: [
    "Each text file (.md, .txt) of the folder or the files given: its house read from its first heading and its name",
    '("<municipality> čp. 16 (…) – research"; two numbers: both houses), its text kept as it came — material of the',
    "house (I…), never changed — and a task to take it over waits (level intake): what it says is written into the",
    "house without searching again. Its links are written into the house as gone through (never searched again), those",
    "of a section to go through by hand or only in a reading room as such. Web pages and the images and map data of",
    "subfolders are not taken, only listed in the task; a file of no house is not taken, and said so.",
    "Which house is never guessed: where it is not clear, a terminal asks; else nothing is taken and the exact command",
    "is said (--house <file>=<house>, --skip <file>). The same file taken again adds nothing.",
  ].join("\n"),
  args: [{ name: "path", description: "a file or a folder of a research", required: true, variadic: true }],
  options: [
    { name: "house", type: "string", multiple: true, value: "<file>=<house>", description: "the house of a file: A…, its key, or <L…|municipality> <number> (made where it is none yet); repeatable, a file of two houses twice" },
    { name: "skip", type: "string", multiple: true, value: "<file>", description: "a file not to take (repeatable)" },
  ],
  examples: ["strom house import ~/Research/House", 'strom house import ~/Research/House --house "notes.md=A0001" --skip draft.md'],
  async run(ctx, { args, opts }) {
    const tree = ctx.tree();
    const paths = args.map((a) => ctx.resolvePath(a));
    for (const p of paths) {
      try {
        fs.statSync(p);
      } catch {
        throw new UsageError(`no file or folder ${ctx.display(p)}`, { code: "house.body" });
      }
    }
    const assign = listOpt(opts.house).map((x) => {
      const at = x.lastIndexOf("=");
      if (at <= 0 || at === x.length - 1) throw new UsageError(`--house "${x}": give <file>=<house>`, { code: "house.body" });
      return { file: x.slice(0, at), house: x.slice(at + 1) };
    });
    const skip = listOpt(opts.skip);
    let plan = planImport(tree, paths, { assign, skip });
    if (plan.questions.length) {
      // asked of the person at a terminal; an agent, a script: nothing taken, the commands said
      if (!ctx.interactive || isAgent(ctx.env)) throw new ImportQuestions(plan.questions);
      const answered = await askQuestions(ctx, tree, plan.questions);
      plan = planImport(tree, paths, { assign: [...assign, ...answered.assign], skip: [...skip, ...answered.skip] });
      if (plan.questions.length) throw new ImportQuestions(plan.questions);
    }
    const done = writeImport(tree, plan, (f) => ctx.display(f));
    const lang = tree.lang;
    const said = (why: string, name: string, input?: string) => ui(lang, `ui.house.import.skipped.${why}` as Parameters<typeof ui>[1], { name, id: input ?? "" });
    return {
      text: lines(
        ...done.map((d) =>
          ui(lang, "ui.house.import.taken", {
            name: path.basename(d.file),
            houses: d.houses.map((h) => h.id).join(", "),
            id: d.input,
            passed: d.houses.reduce((n, h) => n + h.passed, 0),
            manual: d.houses.reduce((n, h) => n + h.manual, 0),
            tasks: [...new Set(d.houses.map((h) => h.task).filter(Boolean))].join(", "),
          }),
        ),
        ...plan.skipped.filter((s) => s.why !== "page" && s.why !== "other").map((s) => said(s.why, s.name, s.input)),
        plan.left.length ? ui(lang, "ui.house.import.left", { list: plan.left.slice(0, 12).join(", ") + (plan.left.length > 12 ? ", …" : "") }) : undefined,
        !done.length ? ui(lang, "ui.house.import.nothing") : undefined,
      ),
      data: { taken: done, skipped: plan.skipped.map(({ file, ...s }) => ({ ...s, file: ctx.display(file) })), left: plan.left },
    };
  },
});
