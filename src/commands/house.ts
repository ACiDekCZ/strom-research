// strom house: the houses of a family tree (spec 030 "the history of a house") — the list, one house whole, a house
// made by the person, what the agent writes of a house item by item, what the person confirms of it, and a research of
// a house the person made themselves taken in (core/houses.ts, core/houseimport.ts).

import { HOUSE_STORY_GENERATIONS, HOUSE_STORY_PEOPLE, askHouseStory } from "../core/housestory.ts";
import fs from "node:fs";
import path from "node:path";
import { register, type CommandDef, type OptionDef } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, table, truncate } from "../cli/format.ts";
import { ui } from "../cli/ui.ts";
import { humanCost } from "../cli/human.ts";
import { NeedsInputError, UsageError } from "../core/errors.ts";
import {
  HOUSE_CERTAINTIES,
  HOUSE_EVENT_KINDS,
  HOUSE_HOLDER_HOWS,
  HOUSE_LOCATION_HOWS,
  HOUSE_LOOK_NEXT,
  HOUSE_MAP_KINDS,
  HOUSE_NUMBER_CERTAINTIES,
  HOUSE_RESIDENT_ROLES,
  type House,
  type HouseCertainty,
  type HouseOrigin,
  type Input,
  type Place,
  type Task,
} from "../core/model.ts";
import { regionsOf, sourceChecklist } from "../core/housesources.ts";
import {
  addHouse,
  addHouseItem,
  confirmHouse,
  dropNoMoreLook,
  findHouse,
  findTown,
  freeLicence,
  houseRows,
  houseSources,
  houseView,
  houseWork,
  listRow,
  recordOf,
  setHouse,
  townRecordOf,
  townView,
  type HouseConfirm,
  type HouseRow,
} from "../core/houses.ts";
import { ImportQuestions, planImport, writeImport, type ImportQuestion } from "../core/houseimport.ts";
import { create, listOpt, normId, update } from "../core/records.ts";
import { isAgent } from "../core/which.ts";
import { askHouse, HOUSE_GROUP_MAX, houseAskEstimate, houseTaskForMaterial } from "../core/houseauto.ts";
import { mapLayer, mapLayers } from "../core/maplayers.ts";
import { rankTasks } from "../core/queue.ts";
import { actsAsArchive } from "../core/state.ts";
import { currentSession } from "../core/session.ts";
import { phrase } from "../core/phrases.ts";
import { now, type Tree } from "../core/tree.ts";

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

/** A word of a command said back, quoted when it is more than letters, digits and a few marks. */
const shellWord = (w: string): string => (/^[\p{L}\p{M}\p{N}|._:\/-]+$/u.test(w) ? w : JSON.stringify(w));

/** The state of a house in the research language. */
const stateWord = (lang: string, s: HouseRow["state"]) => ui(lang, `ui.house.state.${s}`);

// ── list and show ───────────────────────────────────────────────────────────────────────────────────────────────

/** How the house's research came: asked for by the person, or by itself (the history of the houses on); its place in the queue. */
function taskWords(tree: Tree, row: HouseRow): string {
  const t = row.task ? tree.get<Task>(row.task) : undefined;
  if (!t || (row.work !== "house" && row.work !== "town")) return "";
  const lang = tree.lang;
  const by = ui(lang, t.asked ? "ui.house.by.asked" : "ui.house.by.auto");
  let at = 0;
  if (row.state === "queued") at = rankTasks(tree, tree.list<Task>("task")).findIndex((r) => r.task.id === t.id) + 1;
  return ` (${by}${at > 0 ? `, ${ui(lang, "ui.house.queue.at", { n: at })}` : ""})`;
}

/** A municipality's skeleton (strom house show --town). */
function townText(tree: Tree, v: Record<string, unknown>): string {
  const lang = tree.lang;
  const place = v.place as { id: string; name: string };
  const list = <T>(key: string) => (v[key] as T[] | undefined) ?? [];
  const part = (key: Parameters<typeof ui>[1], items: string[]) => (items.length ? [ui(lang, key), ...items.map((x) => `  ${x}`)].join("\n") : undefined);
  return lines(
    `${v.id ? `${String(v.id)} ` : ""}${ui(lang, "ui.house.town")}: ${place.id} ${place.name}${v.done ? ` — ${ui(lang, "ui.house.town.done", { day: String(v.done) })}` : ""}${v.task ? ` · ${String(v.task)} ${String(v.state)}` : ""}`,
    v.text ? `${ui(lang, "ui.house.town.summary")}: ${String(v.text)}` : undefined,
    part("ui.house.maps", list<{ id: string; kind: string; label?: string; url?: string }>("maps").map((m) => `${m.id} ${m.kind}${m.label ? ` ${m.label}` : ""}${m.url ? ` ${m.url}` : ""}`)),
    part("ui.house.passed", list<{ id: string; what: string; url?: string }>("passed").map((x) => `${x.id} ${x.what}${x.url ? ` ${x.url}` : ""}`)),
    part("ui.house.manual", list<{ id: string; what: string; url?: string }>("manual").map((x) => `${x.id} ${x.what}${x.url ? ` ${x.url}` : ""}`)),
    part("ui.house.fieldNames", list<{ id: string; name: string; kind?: string; house?: string; lat?: number; lon?: number }>("fieldNames").map((x) => `${x.id} ${x.name}${x.kind ? ` (${x.kind})` : ""}${x.house ? ` · ${x.house}` : ""}${x.lat !== undefined ? ` · ${x.lat}, ${x.lon}` : ""}`)),
    part("ui.house.pictures", list<{ id: string; url: string; license: string; shows: string }>("pictures").map((x) => `${x.id} ${x.shows} · ${x.license} ${x.url}`)),
    part("ui.house.unknown", list<{ id: string; text: string }>("unknown").map((x) => `${x.id} ${x.text}`)),
    part("ui.house.archiveOnly", list<{ id: string; archive: string; fond?: string; signature?: string }>("archiveOnly").map((a) => `${a.id} ${[a.archive, a.fond, a.signature].filter(Boolean).join(", ")}`)),
    !v.id ? ui(lang, "ui.house.empty") : undefined,
  );
}

function showText(tree: Tree, row: HouseRow, v: Record<string, unknown>): string {
  const lang = tree.lang;
  const h = row.record ? tree.get<House>(row.record.id) : undefined;
  const src = (s: { source?: string; page?: string; url?: string }[] | undefined) => (s?.length ? ` [${s.map((x) => [x.source, x.page, x.url].filter(Boolean).join(" ")).join("; ")}]` : "");
  const span = (x: { from?: string; to?: string }) => (x.from || x.to ? ` ${x.from ?? ""}–${x.to ?? ""}` : "");
  const by = (o: HouseOrigin) => (o === "research" ? "" : ` (${ui(lang, `ui.house.origin.${o}`)})`);
  const sure = (c: HouseCertainty | "probable") => ui(lang, `ui.house.certainty.${c}`);
  const part = (key: Parameters<typeof ui>[1], items: string[]) => (items.length ? [ui(lang, key), ...items.map((x) => `  ${x}`)].join("\n") : undefined);
  const head = `${row.id ? `${row.id} ` : ""}${row.place.name} ${row.house}${row.name ? ` „${row.name}“` : ""} — ${stateWord(lang, row.state)}${row.task ? ` ${row.task}` : ""}${taskWords(tree, row)}`;
  const people = row.tree ? [...row.tree.persons].sort() : [];
  return lines(
    head,
    `${ui(lang, "ui.house.key")}: ${row.key}`,
    people.length ? `${ui(lang, "ui.house.persons")}: ${people.join(", ")}${row.years ? ` (${row.years.from === row.years.to ? row.years.from : `${row.years.from}–${row.years.to}`})` : ""}` : undefined,
    row.question ? `${ui(lang, "ui.house.question")}: ${row.question.id} ${row.question.text}` : undefined,
    part("ui.house.numbers", (h?.numbers ?? []).filter((n) => !n.notSame).map((n) => `${n.id} ${n.number}${span(n)} · ${sure(n.certainty)}${n.proposed ? ` · ${ui(lang, n.confirmed ? "ui.house.confirmed" : "ui.house.proposed")}` : ""}${n.text ? ` — ${n.text}` : ""}${src(n.sources)}${by(n.origin)}`)),
    h?.location
      ? part("ui.house.location", [`${h.location.lat}, ${h.location.lon} · ${h.location.how} · ${sure(h.location.certainty)}${h.location.confirmed ? ` · ${ui(lang, "ui.house.confirmed")} ${h.location.confirmed}` : ""}${src(h.location.sources)}${by(h.location.origin)}`])
      : undefined,
    part("ui.house.timeline", (h?.timeline ?? []).map((e) => `${e.id} ${e.date ?? "?"} ${e.kind}: ${e.text} · ${sure(e.certainty)}${h?.sensitive?.includes(e.id) ? ` · ${ui(lang, "ui.house.sensitive")}` : ""}${src(e.sources)}${by(e.origin)}`)),
    part("ui.house.holders", (h?.holders ?? []).map((x) => `${x.id} ${x.name}${x.person ? ` (${x.person})` : ""}${span(x)} · ${x.how} · ${sure(x.certainty)}${src(x.sources)}${by(x.origin)}`)),
    part("ui.house.residents", (h?.residents ?? []).map((x) => `${x.id} ${x.name}${x.person ? ` (${x.person})` : ""} · ${x.role}${span(x)}${x.certainty ? ` · ${sure(x.certainty)}` : ""}${src(x.sources)}${by(x.origin)}`)),
    h?.look ? part("ui.house.look", [`${h.look.text} · ${sure(h.look.certainty)}${(h.look.images ?? []).map((i) => ` [${[i.url, i.file, i.license].filter(Boolean).join(" ")}]`).join("")}`]) : undefined,
    // none: what is not known of its look says it (Not known), once
    h?.lookCheck && !(h.lookCheck.next === "none" && (h.unknown ?? []).some((u) => u.about === "look"))
      ? part("ui.house.lookCheck", [`${ui(lang, `ui.house.lookNext.${h.lookCheck.next}`)}: ${h.lookCheck.text}`])
      : undefined,
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
    args: [{ name: "house", description: "A…, its key (town|number), or its municipality and number (L… 16, Lhota 16); none with --town", required: false, variadic: true }],
    options: [{ name: "town", type: "string", value: "<L…|name>", description: "the municipality's skeleton instead: its summary, what was gone through, what is only by hand, its maps" }],
    examples: ["strom house show A0001", 'strom house show "lhota|16" --json', "strom house show L0001 16", "strom house show --town L0001"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const townRef = opt(opts.town);
      if (townRef && args.length) throw new UsageError("either a house or --town, not both", { code: "house.body", hint: "strom house show --town L0001" });
      if (townRef) {
        const v = townView(tree, findTown(tree, townRef));
        return { text: townText(tree, v), data: { town: v } };
      }
      if (!args.length) throw new UsageError("which house?", { code: "house.body", hint: "strom house list" });
      const row = findHouse(tree, args.join(" "));
      const v = houseView(tree, row);
      return { text: showText(tree, row, v), data: { house: v } };
    },
  },
  {
    path: ["house", "sources"],
    summary: "The list of sources a house's research goes through, for its country (yours, never the house's)",
    group: "sources",
    tree: true,
    args: [{ name: "house", description: "A…, its key (town|number), or its municipality and number; none with --town", required: false, variadic: true }],
    options: [
      { name: "town", type: "string", value: "<L…|name>", description: "the list of a municipality's skeleton instead" },
      { name: "look", type: "boolean", description: "the list of a house's look instead" },
    ],
    description: [
      "What the brief of a house's task lists (spec 145): the sources of the house's country by its municipality's point",
      "(the general list where no region holds it), a special house's besides; with --town the skeleton's, with --look its",
      "look's. The list is for the agent: into the house goes only what said something, one line of what was gone",
      "through (strom house add passed … --checklist) and the steps by hand that belong to it.",
    ].join("\n"),
    examples: ["strom house sources A0001", "strom house sources --town L0001 --json", "strom house sources A0001 --look"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const townRef = opt(opts.town);
      if (townRef && args.length) throw new UsageError("either a house or --town, not both", { code: "house.body", hint: "strom house sources --town L0001" });
      if (!townRef && !args.length) throw new UsageError("which house?", { code: "house.body", hint: "strom house sources A0001 · strom house list" });
      const place = townRef ? findTown(tree, townRef).id : findHouse(tree, args.join(" ")).place.id;
      const work = townRef ? "town" : opts.look ? "look" : "house";
      const list = sourceChecklist(tree, place, work);
      const regions = regionsOf(place ? tree.get<Place>(place) : undefined).map((r) => r.id);
      return { text: list.length ? list.join("\n") : "no list of sources ships for this", data: { work, ...(place ? { place } : {}), regions, lines: list } };
    },
  },
  {
    path: ["house", "request"],
    summary: "Look for the history of a house (the person's word): its task first of all, the next session — whatever the setting houses says",
    group: "sources",
    tree: true,
    writes: true,
    hidden: true,
    person: "Look for the history of this house (one session of the agent)?",
    description: [
      "Its numbers in time and its point on the map, what happened to it, its holders and residents, its look. Its task",
      "comes first at the next session of strom run; its municipality's skeleton before it when it has none. With the",
      "history of the houses on, its task waiting in the queue moves first; a house researched already is looked for",
      "again (what was gone through is not gone through again). Only a house where somebody of the family tree lived,",
      `its municipality a place record. --with: neighbouring houses of the same family there, in the same session (at most ${HOUSE_GROUP_MAX - 1}).`,
      "The person's: in a terminal it asks with what it takes (--yes: no question); without one --yes is needed.",
    ].join("\n"),
    args: [{ name: "house", description: "A…, its key (town|number), or its municipality and number", required: true, variadic: true }],
    options: [{ name: "with", type: "string", multiple: true, value: "<house>", description: `a neighbouring house of the same family in the same municipality (A… or its key; at most ${HOUSE_GROUP_MAX - 1})` }],
    examples: ["strom house request A0001", "strom house request A0001 --with A0002 --yes", 'strom house request "lhota|16"'],
    refusesFirst(ctx) {
      if (actsAsArchive(ctx.tree())) throw new UsageError("an archive looks for nothing: its research is the person's alone", { code: "house.archive" });
    },
    async run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const ref = args.join(" ");
      const withRefs = listOpt(opts.with);
      // checked before the question: a house of the tree, its municipality a place (nothing written)
      const rows = houseRows(tree, { on: true });
      const row = findHouse(tree, ref, rows);
      if (!row.tree?.persons.size) throw new UsageError(`nobody of the tree lived in the house ${row.id ?? row.key} — only such a house is researched`, { code: "house.unknown", hint: "strom house list" });
      if (!row.place.id) throw new UsageError(`the municipality of the house "${row.key}" is no place record yet`, { code: "house.town", hint: `strom place add "${row.place.name}", then again` });
      const lang = tree.lang;
      const label = `${row.place.name} ${row.house}`;
      const { minutes, usd, measured } = houseAskEstimate(tree, row.place.id, 1 + withRefs.length);
      if (!ctx.yes) {
        if (!ctx.interactive)
          throw new NeedsInputError([{ key: "house.request", kind: "consent", question: ui(lang, "ui.house.ask", { house: label }), set: ["strom house request", ...args.map(shellWord), ...withRefs.flatMap((w) => ["--with", shellWord(w)]), "--yes"].join(" ") }]);
        ctx.io.stdout(`${lines(ui(lang, "ui.house.minutes", { minutes }), usd !== undefined ? ui(lang, "ui.house.usd", { usd: humanCost(usd, lang) }) : undefined)}\n`);
        if (!(await ctx.confirm(ui(lang, "ui.house.ask", { house: label }), false))) return { text: ui(lang, "ui.house.kept"), data: { house: row.id ?? row.key, asked: false } };
      }
      if (tree.dryRun) return { text: `would look for the history of the house ${row.id ?? row.key}`, data: { house: row.id ?? row.key, asked: false } };
      const out = askHouse(tree, ref, withRefs, ctx.settings);
      return {
        text: lines(...tree.written.map((o) => o.summary), ui(lang, out.again ? "ui.house.again" : "ui.house.asked", { house: label }), `${out.task}: strom run takes it next (now: strom run --task ${out.task})`),
        data: { ...out, asked: true, estimate: { minutes, ...(usd !== undefined ? { usd } : {}), measured } },
      };
    },
  },
  {
    path: ["house", "story"],
    summary: "Ask for the story of a house (the person's word): its task first of all, written from what its research found",
    group: "sources",
    tree: true,
    writes: true,
    hidden: true,
    person: "Write the story of this house from what its research found?",
    description: [
      "The story of the house for the family: its holders, the families in it over the generations, what happened to it,",
      "its numbers in time, its look — each statement on a fact of the house or of its people, what is uncertain said so.",
      "Its task comes first at the next session of strom run, whatever the setting stories says and however much the",
      "house tells. A draft until approved (strom story approve A…); an approved one stays, a new version waits beside it.",
      "Only a house with a record (its research, or something of it written). By itself (the stories on) it comes after",
      `the last step of a house's research when the house tells enough: ${HOUSE_STORY_GENERATIONS} generations of the tree in it or ${HOUSE_STORY_PEOPLE} holders and residents with sources.`,
      "The person's: in a terminal it asks (--yes: no question); without one --yes is needed.",
    ].join("\n"),
    args: [{ name: "house", description: "A…, its key (town|number), or its municipality and number", required: true, variadic: true }],
    examples: ["strom house story A0001", "strom house story A0001 --yes"],
    refusesFirst(ctx) {
      if (actsAsArchive(ctx.tree())) throw new UsageError("an archive writes nothing: its research is the person's alone", { code: "house.archive" });
    },
    async run(ctx, { args }) {
      const tree = ctx.tree();
      const ref = args.join(" ");
      const row = findHouse(tree, ref, houseRows(tree, { on: true }));
      if (!row.id) throw new UsageError(`nothing of the house "${row.key}" is written yet — its story is written from its research`, { code: "house.story.none", hint: `its research first: strom house request "${row.key}"` });
      const lang = tree.lang;
      const label = `${row.place.name} ${row.house}`;
      if (!ctx.yes) {
        if (!ctx.interactive)
          throw new NeedsInputError([{ key: "house.story", kind: "consent", question: ui(lang, "ui.house.story.ask", { house: label }), set: ["strom house story", ...args.map(shellWord), "--yes"].join(" ") }]);
        if (!(await ctx.confirm(ui(lang, "ui.house.story.ask", { house: label }), false))) return { text: ui(lang, "ui.house.kept"), data: { house: row.id, asked: false } };
      }
      if (tree.dryRun) return { text: `would ask for the story of the house ${row.id}`, data: { house: row.id, asked: false } };
      const out = askHouseStory(tree, ref);
      return {
        text: lines(...tree.written.map((o) => o.summary), ui(lang, "ui.house.story.asked", { house: label }), `${out.task}: strom run takes it next (now: strom run --task ${out.task})`),
        data: { ...out, asked: true },
      };
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
      "number|location|passed|manual|unknown|archive-only|look|map|material|name <house> … (a municipality's skeleton: --town, and summary) — a house of the tree's facts",
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
/** What a source's reading says in the place of a claim of the research's own taken over unread (spec 145 T7). */
const REPLACES: OptionDef = { name: "replaces", type: "string", value: "<item>", description: "an item of the research's own this one takes the place of, its ID kept (what a source read now says of a claim taken over unread); the person's items stay" };
const replaces = (opts: Record<string, unknown>) => opt(opts.replaces);
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

/** Material given to a house (its inputs, not retracted nor hidden). */
function materialAt(tree: Tree, h: House): boolean {
  return tree.list<Input>("input").some((i) => !i.retracted && !i.hidden && (i.houses ?? []).includes(h.id));
}

/** The house the item goes to: its record, made for a house of the tree's facts by the first item. */
function target(tree: Tree, ref: string[]): House {
  return recordOf(tree, findHouse(tree, ref.join(" ")));
}

/** A picture only under a free licence (spec 145 T1): else only its link, by hand. */
function notFree(license: string, manual: string): void {
  if (!freeLicence(license))
    throw new UsageError(`"${license}" allows no free use: a picture only under a free licence (public domain, CC0, CC BY, CC BY-SA, GFDL, Free Art License, an open government licence) — never NC, ND or all rights reserved`, {
      code: "house.body",
      hint: `its link only, to be seen by hand: strom house add manual ${manual}`,
    });
}

type ItemRun = (ctx: Context, tree: Tree, h: House, opts: Record<string, unknown>) => { id?: string; what: string; task?: string };

/**
 * What a municipality's skeleton holds (spec 030 part 2: its record of the houses' research, no number): what was gone
 * through, what is only by hand, what is not known, what is only in a reading room, its maps, its summary.
 */
const TOWN_KINDS = new Set(["passed", "manual", "unknown", "archive-only", "map", "summary", "picture", "field-name"]);
/** What only a municipality's skeleton holds (--town, no house): its summary, its pictures, its field names (spec 145). */
const TOWN_ONLY = new Set(["summary", "picture", "field-name"]);
const TOWN_OPTION: OptionDef = { name: "town", type: "string", value: "<L…|name>", description: "the municipality's skeleton instead of a house (what its houses' research stands on: no house argument)" };

function itemCommand(kind: string, summary: string, options: OptionDef[], examples: string[], run: ItemRun, description?: string): CommandDef {
  const town = TOWN_KINDS.has(kind);
  const only = TOWN_ONLY.has(kind);
  return {
    path: ["house", "add", kind],
    summary,
    group: "sources",
    tree: true,
    writes: true,
    ...(description ? { description } : {}),
    args: only ? [] : [{ name: "house", description: `A…, its key (town|number), or its municipality and number${town ? " (none with --town)" : ""}`, required: !town, variadic: true }],
    options: town ? [...(only ? [{ ...TOWN_OPTION, description: "the municipality: L… or its name" }] : [TOWN_OPTION]), ...options] : options,
    examples,
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const townRef = town ? opt(opts.town) : undefined;
      if (townRef && args.length) throw new UsageError("either a house or --town, not both", { code: "house.body", hint: `strom house add ${kind} --town <L…> …` });
      if (!townRef && (only || !args.length)) throw new UsageError(only ? "missing --town" : "which house?", { code: "house.body", hint: only ? `strom house add ${kind} --town L0001 …` : "strom house list" });
      const place = townRef ? findTown(tree, townRef) : undefined;
      const out = tree.withTreeLock(() => {
        const h = place ? townRecordOf(tree, place) : target(tree, args);
        const r = run(ctx, tree, h, opts);
        return { h, ...r };
      });
      const v = place ? townView(tree, place) : houseView(tree, findHouse(tree, out.h.id));
      return {
        text: lines(
          ...tree.written.map((o) => o.summary),
          out.id ? `${out.id} written to ${out.h.id} (${out.what})` : `${out.h.id}: ${out.what}`,
          out.task
            ? houseWork(tree.get<Task>(out.task) ?? { origin: "" }) === "look"
              ? `${out.task}: the house's look, raised by its material given after its research (the look of the houses is on)`
              : `${out.task}: the house's research, raised by its material (the history of the houses is on)`
            : undefined,
        ),
        data: { house: out.h.id, ...(place ? { town: place.id } : {}), ...(out.id ? { item: out.id } : {}), ...(out.task ? { task: out.task } : {}), view: v },
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
/**
 * Today's holders and residents are never written (spec 030 K1.4a, K6.7): an open record (no --until) since a year of
 * the last HOUSE_RECENT years is refused unless it is a person of the tree (--person).
 */
const HOUSE_RECENT = 100;
function notToday(opts: Record<string, unknown>, person: string | undefined, what: "holder" | "resident"): void {
  const s = span(opts);
  const year = Number(/\p{N}{4}/u.exec(s.from ?? "")?.[0] ?? NaN);
  if (person || s.to || !Number.isFinite(year) || year < new Date().getFullYear() - HOUSE_RECENT) return;
  throw new UsageError(`a ${what} since ${s.from} with no end is one of today's — today's holders and residents of a house are never written`, {
    code: "house.body",
    hint: `one who left or died: --until <year>; a person of the family tree: --person P…; otherwise leave them out`,
  });
}

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
      REPLACES,
    ],
    ['strom house add event A0001 --kind fire --date 1868-05 --text "<what the chronicle says>" --certainty medium --url https://example.org/chronicle', "strom house add event A0001 --kind transfer --date 1781 --text \"<who bought it>\" --source S0001 --locator \"fol. 12\" --certainty high", 'strom house add event A0001 --replaces e1 --kind fire --date 1905-11 --text "<what the source read now says>" --source S0002 --locator "<page>" --certainty medium'],
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
      }, "event", replaces(opts));
      if (opts.sensitive === true && !house.sensitive?.includes(id)) setHouse(tree, house.id, (x) => void (x.sensitive = [...(x.sensitive ?? []), id]), `${id} sensitive`);
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
      REPLACES,
    ],
    ['strom house add holder A0001 --name "<holder>" --person P0001 --since 1858 --until 1890 --how marriage --source S0001 --certainty high'],
    (ctx, tree, h, opts) => {
      const p = person(tree, opts.person);
      notToday(opts, p, "holder");
      const { id } = addHouseItem(tree, h.id, "holders", {
        name: text(opts.name, "name", 200),
        ...(p ? { person: p } : {}),
        ...span(opts),
        how: oneOf(opts.how ?? "other", HOUSE_HOLDER_HOWS, "how"),
        certainty: certainty(opts),
        ...(sources(tree, opts) ? { sources: sources(tree, opts)! } : {}),
        origin: originOf(ctx, tree, opts).origin,
      }, "holder", replaces(opts));
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
      REPLACES,
    ],
    ['strom house add resident A0001 --name "<resident>" --role lodger --since 1880 --until 1880 --source S0001'],
    (ctx, tree, h, opts) => {
      const p = person(tree, opts.person);
      notToday(opts, p, "resident");
      const { id } = addHouseItem(tree, h.id, "residents", {
        name: text(opts.name, "name", 200),
        ...(p ? { person: p } : {}),
        role: oneOf(opts.role ?? "other", HOUSE_RESIDENT_ROLES, "role"),
        ...span(opts),
        ...(opts.certainty !== undefined ? { certainty: certainty(opts) } : {}),
        ...(sources(tree, opts) ? { sources: sources(tree, opts)! } : {}),
        origin: originOf(ctx, tree, opts).origin,
      }, "resident", replaces(opts));
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
      REPLACES,
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
      }, "number", replaces(opts));
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
      { name: "checklist", type: "boolean", description: "the one line naming what of the brief's list of sources was gone through (\"gone through: …\"); what said something is a finding of its own" },
    ],
    ['strom house add passed A0001 --what "<register and its years, entries with no. 16>" --source S0001 --found yes', 'strom house add passed A0001 --checklist --what "<gone through: the address register, the field names, the orthophoto>"'],
    (ctx, tree, h, opts) => {
      const found = opts.found === undefined ? undefined : oneOf(opts.found, ["yes", "no"] as const, "found") === "yes";
      const src = opt(opts.source) ? normId(opt(opts.source)!, "source") : undefined;
      if (src && !tree.get(src)) throw new UsageError(`no source ${src}`, { code: "house.body" });
      if (opt(opts.url) && !/^https?:\/\//iu.test(opt(opts.url)!)) throw new UsageError(`"${opt(opts.url)}" is no web address`, { code: "house.body" });
      const { id } = addHouseItem(tree, h.id, "passed", { what: text(opts.what, "what", 1000), ...(src ? { source: src } : {}), ...(opt(opts.url) ? { url: opt(opts.url)! } : {}), ...(found !== undefined ? { found } : {}), ...(opts.checklist === true ? { checklist: true as const } : {}), origin: originOf(ctx, tree, opts).origin }, opts.checklist === true ? "the list gone through" : "gone through");
      return { id, what: opts.checklist === true ? "the list of sources gone through" : "gone through" };
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
      { name: "look", type: "boolean", description: "of the house's look: what more of it cannot be found automatically, and why" },
    ],
    ['strom house add unknown A0001 --text "<who held the house from 1856 to 1858?>"', 'strom house add unknown A0001 --look --text "<no picture of the house; the indication sketch only by hand>"'],
    (ctx, tree, h, opts) => {
      const q = opt(opts.question) ? normId(opt(opts.question)!, "task") : undefined;
      if (q && !tree.get<Task>(q)) throw new UsageError(`no task ${q}`, { code: "house.body" });
      const { id } = addHouseItem(tree, h.id, "unknown", { text: text(opts.text, "text", 1000), ...(q ? { question: q } : {}), ...(opts.look === true ? { about: "look" as const } : {}), origin: originOf(ctx, tree, opts).origin }, "not known");
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
      if (opt(opts.license) && listOpt(opts.image).some((x) => /^https?:\/\//iu.test(x))) notFree(opt(opts.license)!, `${h.id} --what "<a picture of it>" --url ${listOpt(opts.image).find((x) => /^https?:\/\//iu.test(x))}`);
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
    "look-check",
    "At the end of a house's research: whether its look has more to find — a task of its look follows where it has",
    [
      {
        name: "next",
        type: "string",
        value: "<what>",
        description: "material (given to the house, nobody has read it), picture (a picture of the municipality seems to show the house), source (a source in hand describes the building more than its look says), none (no more automatically)",
      },
      { name: "text", type: "string", value: "<text>", description: "why, in the research language: what there is to read — or, with none, why no more", max: 1000 },
    ],
    ['strom house add look-check A0001 --next picture --text "<the picture of the green shows no. 9>"', 'strom house add look-check A0001 --next none --text "<no picture of it; the indication sketch only by hand>"'],
    (ctx, tree, h, opts) => {
      const next = oneOf(opts.next, HOUSE_LOOK_NEXT, "next");
      const why = text(opts.text, "text", 1000);
      if (next === "material" && !materialAt(tree, h))
        throw new UsageError(`no material lies at ${h.id} — material: only what was given to the house`, { code: "house.body", hint: `strom house show ${h.id} — another --next, or none` });
      const task = currentSession(tree, ctx.env, ctx.refs)?.task;
      const origin = originOf(ctx, tree, opts).origin;
      // no more automatically: what is not known of its look, said once in the research language (spec 145 T1) — the
      // research's own earlier word of it (unknown --look) takes the check's why, the person's or a material's stays;
      // never a second one (no noise, T5)
      const said = next === "none" ? phrase(tree.lang, "house.look.unknown", { why }).slice(0, 1000) : undefined;
      const had = said ? (h.unknown ?? []).find((u) => u.about === "look" && u.origin === "research" && !u.question) ?? (h.unknown ?? []).find((u) => u.about === "look") : undefined;
      setHouse(
        tree,
        h.id,
        (x) => {
          // a check that finds more: the research's own "no more automatically" of an earlier one is gone (N5)
          if (next !== "none") dropNoMoreLook(x, tree.lang);
          x.lookCheck = { next, text: why, ...(task ? { task } : {}), at: now(), origin };
          const own = had && had.origin === "research" && !had.question ? (x.unknown ?? []).find((u) => u.id === had.id) : undefined;
          if (own && said) own.text = said;
        },
        `look check: ${next}`,
      );
      const id = said ? (had?.id ?? addHouseItem(tree, h.id, "unknown", { text: said, about: "look", origin }, "look not known").id) : undefined;
      return { ...(id ? { id } : {}), what: next === "none" ? "look check: no more automatically" : `look check: ${next} — a task of its look follows the research` };
    },
  ),
  itemCommand(
    "picture",
    "Write a picture of the municipality under a free licence: its address, its licence, what it shows",
    [
      { name: "url", type: "string", value: "<address>", description: "the picture's address" },
      { name: "license", type: "string", value: "<licence>", description: "its free licence (CC BY 4.0, public domain)", max: 200 },
      { name: "credit", type: "string", value: "<text>", description: "whose it is", max: 300 },
      { name: "shows", type: "string", value: "<text>", description: "what it shows (the green, a street, a house number where it can be read), in the research language", max: 1000 },
    ],
    ['strom house add picture --town L0001 --url https://example.org/green.jpg --license "CC BY-SA 4.0" --credit "<author>" --shows "<the green from the south, no. 9 readable>"'],
    (ctx, tree, h, opts) => {
      const url = text(opts.url, "url", 2000);
      if (!/^https?:\/\//iu.test(url)) throw new UsageError(`"${url}" is no web address`, { code: "house.body" });
      const license = text(opts.license, "license", 200);
      notFree(license, `--town ${h.place} --what "<what it shows>" --url ${url}`);
      const { id } = addHouseItem(tree, h.id, "pictures", { url, license, ...(opt(opts.credit) ? { credit: opt(opts.credit)! } : {}), shows: text(opts.shows, "shows", 1000), origin: originOf(ctx, tree, opts).origin }, "picture");
      return { id, what: "picture of the municipality" };
    },
  ),
  itemCommand(
    "field-name",
    "Write a field name of the municipality: a mill, a farm, a solitude, with its point and the house it lies at",
    [
      { name: "name", type: "string", value: "<name>", description: "the name as the gazetteer writes it", max: 200 },
      { name: "kind", type: "string", value: "<kind>", description: "what it names (mill, farm, solitude, field)", max: 100 },
      { name: "lat", type: "string", value: "<deg>", description: "latitude" },
      { name: "lon", type: "string", value: "<deg>", description: "longitude" },
      { name: "house", type: "string", value: "<no.>", description: "the house number it lies at, where its point says so", max: 100 },
      { name: "url", type: "string", value: "<address>", description: "where it is written" },
      { name: "source", type: "string", value: "<S…>", description: "the source that names it" },
    ],
    ['strom house add field-name --town L0001 --name "<the mill below the village>" --kind mill --lat 49.61 --lon 15.12 --house 14 --url https://example.org/names'],
    (ctx, tree, h, opts) => {
      const point = opts.lat === undefined && opts.lon === undefined ? undefined : { lat: Number(opts.lat), lon: Number(opts.lon) };
      if (point && (!Number.isFinite(point.lat) || !Number.isFinite(point.lon) || Math.abs(point.lat) > 90 || Math.abs(point.lon) > 180))
        throw new UsageError("--lat (±90) and --lon (±180) in degrees, both", { code: "house.body" });
      if (opt(opts.url) && !/^https?:\/\//iu.test(opt(opts.url)!)) throw new UsageError(`"${opt(opts.url)}" is no web address`, { code: "house.body" });
      const src = opt(opts.source) ? normId(opt(opts.source)!, "source") : undefined;
      if (src && !tree.get(src)) throw new UsageError(`no source ${src}`, { code: "house.body" });
      const { id } = addHouseItem(tree, h.id, "fieldNames", {
        name: text(opts.name, "name", 200),
        ...(opt(opts.kind) ? { kind: opt(opts.kind)! } : {}),
        ...(point ?? {}),
        ...(opt(opts.house) ? { house: opt(opts.house)! } : {}),
        ...(opt(opts.url) ? { url: opt(opts.url)! } : {}),
        ...(src ? { source: src } : {}),
        origin: originOf(ctx, tree, opts).origin,
      }, "field name");
      return { id, what: "field name" };
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
      { name: "layer", type: "string", value: "<id>", description: `a map layer strom ships that the Strom app draws over the house's place (${mapLayers().map((l) => l.id).join(", ") || "none"}); --kind then may be left out` },
    ],
    ['strom house add map A0001 --kind cadastre --url https://example.org/sheet --manual --sheet "<sheet 3>"'],
    (ctx, tree, h, opts) => {
      if (opt(opts.url) && !/^https?:\/\//iu.test(opt(opts.url)!)) throw new UsageError(`"${opt(opts.url)}" is no web address`, { code: "house.body" });
      const layer = opt(opts.layer) ? mapLayer(opt(opts.layer)!) : undefined;
      if (opt(opts.layer) && !layer) throw new UsageError(`no map layer "${opt(opts.layer)}" — strom ships: ${mapLayers().map((l) => l.id).join(", ") || "none"}`, { code: "house.body" });
      const { id } = addHouseItem(tree, h.id, "maps", {
        kind: opts.kind === undefined && layer?.kind ? layer.kind : oneOf(opts.kind, HOUSE_MAP_KINDS, "kind"),
        ...(layer ? { layer: layer.id } : {}),
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
    "summary",
    "Write the short summary of a municipality's skeleton: its lordship and estate, parish, cadastral area, where its land registers are",
    [{ name: "text", type: "string", value: "<text>", description: "the summary, in the research language", max: 2000 }],
    ['strom house add summary --town L0001 --text "<lordship, parish, cadastral area, land registers>"'],
    (_ctx, tree, h, opts) => {
      const t = text(opts.text, "text", 2000);
      setHouse(tree, h.id, (x) => void (x.text = t), "summary");
      return { what: "summary" };
    },
  ),
  itemCommand(
    "material",
    "Make a material of the research (I…) one of the house's — a photo of it, a document of it — or write down a memory of it the person told; no task while the history of the houses is off (on: a house of the tree with none gets its research)",
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
      // the history of the houses on: a house of the tree given material gets its research (spec 030 §4.1 answer 7)
      const raised = () => houseTaskForMaterial(tree, h.id, ctx.settings);
      if (!memory) {
        const task = raised();
        return { what: `material ${ids.join(", ")}`, ...(task ? { task } : {}) };
      }
      if (memory.length > 20000) throw new UsageError("--memory is longer than 20000 characters", { code: "house.body" });
      // the witness's name only with their consent (spec 030 §2.7)
      const witness = opts["witness-consent"] === true ? opt(opts.witness) : undefined;
      const i = create<Input>(
        tree,
        "input",
        { name: truncate(memory, 60), text: memory, kind: "text", state: "new", from: isAgent(ctx.env) ? "research" : "user", houses: [h.id], ...(witness ? { witness } : {}) },
        (iid) => `+${iid} input text, a memory of ${h.id}`,
      );
      const task = raised();
      return { id: i.id, what: `material ${[...ids, i.id].join(", ")}`, ...(task ? { task } : {}) };
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
    { name: "house", type: "string", multiple: true, value: "<file>=<house>", description: "a house of a file besides those its heading names clearly: A…, its key, or <L…|municipality> <number> (made where it is none yet); repeatable, two houses not in the tree twice" },
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
