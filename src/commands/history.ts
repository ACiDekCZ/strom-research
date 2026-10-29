// history status · map · region · add · page · local · retract · done — and the person's own redo · first · hide · show ·
// skip · unskip · assign: what the
// ancestors lived through (the experiment experiments.history, core/pastevents.ts). Behind its gate (hidden): runs
// when named, shown nowhere until the Strom app shows the events. `strom history` alone stays what changed recently.

import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, table } from "../cli/format.ts";
import { ui } from "../cli/ui.ts";
import { UsageError } from "../core/errors.ts";
import { listOpt, normId } from "../core/records.ts";
import { refuseInArchive } from "../core/state.ts";
import { dateYears } from "../core/gdate.ts";
import { parseYears } from "../core/years.ts";
import { clipMark } from "../core/excerpt.ts";
import { resolvePerson } from "../core/people.ts";
import { checkQuotes, cleanText, findPassages, mainQuote, pageParts, PageError, quotesShape, readPage, PART_CHARS } from "../core/pagecheck.ts";
import { currentSession } from "../core/session.ts";
import {
  addLocalEvent,
  addRegionEvent,
  askFirst,
  assignPlace,
  checkKind,
  checkTexts,
  checkYears,
  deleteEvent,
  ensureRegion,
  factPlaceKey,
  hideEvent,
  historyAnswer,
  historyStatus,
  forGaps,
  forHistory,
  gapsOfTask,
  gapText,
  historyOrder,
  historyHeld,
  historyTurn,
  mapPlace,
  raiseHistoryTasks,
  markDone,
  donePeriod,
  noteTried,
  readCatalog,
  redoRegion,
  refuseBeforePage,
  REGION_LANGS,
  regionIdOk,
  regionOfTask,
  requireHistoryOn,
  requireRegionId,
  retractEvent,
  skipHistory,
  EVENT_KINDS,
  type RegionLink,
  type Sameness,
  yearsToSearch,
  type Texts,
  whoSees,
  readPlaces,
  inRegion,
  regionName,
  placeRecordOf,
} from "../core/pastevents.ts";
import {
  addPlaceEvent,
  askPlace,
  refusePlaceAsk,
  ensurePlaceCatalog,
  markPlaceDone,
  factsByRecord,
  notePlaceTried,
  placeEstimate,
  placeKeyOf,
  placeLabel,
  placeOfTask,
  readPlaceCatalog,
  refusePlaceBeforePage,
  refusePlaceSame,
  requirePlace,
  setArea,
  yearsAt,
} from "../core/placehistory.ts";
import type { Place, RecordSet, Source, Task } from "../core/model.ts";
import type { Tree } from "../core/tree.ts";
// strom history list
import { moreLine, paginate } from "../cli/format.ts";
import type { UIKey } from "../cli/ui.ts";
import { displayName } from "../core/people.ts";
import { historyOn, readLocal, type AppEvent, type AppPlace, type EventKind, type Hide } from "../core/pastevents.ts";
import { placeRecord } from "../core/placehistory.ts";
import { foldText } from "../core/text.ts";
import type { Person } from "../core/model.ts";

function shared(ctx: Context): string {
  const s = ctx.settings.shared()?.value;
  if (!s) throw new UsageError("no shared folder is set — the catalogs of the regions live there", { code: "history.shared", hint: "strom setup" });
  return s;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

function year(v: unknown, name: string): number | undefined {
  const s = str(v);
  if (s === undefined) return undefined;
  if (!/^\d{3,4}$/u.test(s.trim())) throw new UsageError(`--${name} ${s}: a year`, { code: "history.years" });
  return Number(s);
}

/** --text-cs, --text-en, --text-de (or why, tip, name) as one set; undefined when none given. */
function texts(opts: Record<string, unknown>, name: string): Texts | undefined {
  const t: Texts = {};
  for (const l of REGION_LANGS) {
    const v = str(opts[`${name}-${l}`]);
    if (v !== undefined) t[l] = v;
  }
  return Object.keys(t).length ? t : undefined;
}

function sameness(opts: Record<string, unknown>): Sameness {
  const s: Sameness = {};
  const sameAs = str(opts["same-as"]);
  const distinct = str(opts.distinct);
  const replaces = str(opts.replaces);
  if ([sameAs, distinct, replaces].filter(Boolean).length > 1 && !(distinct && replaces))
    throw new UsageError("--same-as goes alone: the same event is one more source of it, never another or a replacement", { code: "history.same.flags" });
  if (sameAs) s.sameAs = sameAs.trim();
  if (distinct) s.distinct = distinct.trim();
  if (replaces) s.replaces = replaces.trim();
  return s;
}

/** "cz-bohemia", "cz-bohemia:1850-1918", "cz-bohemia:-1918", "cz-bohemia:1850-" */
function regionLink(spec: string): RegionLink {
  const [id = "", years] = spec.trim().split(":", 2) as [string, string | undefined];
  requireRegionId(id);
  if (years === undefined || years === "") return { id };
  const m = /^(\d{3,4})?\s*[-‐‑‒–—―−]\s*(\d{3,4})?$/u.exec(years.trim());
  const one = /^(\d{3,4})$/u.exec(years.trim());
  if (one) return { id, from: Number(one[1]), to: Number(one[1]) };
  if (!m || (m[1] === undefined && m[2] === undefined)) throw new UsageError(`--region ${spec}: <region>[:<from>-<to>] (e.g. cz-bohemia:1850-1918, cz-bohemia:-1918)`, { code: "history.region.years" });
  const link: RegionLink = { id, ...(m[1] ? { from: Number(m[1]) } : {}), ...(m[2] ? { to: Number(m[2]) } : {}) };
  if (link.from !== undefined && link.to !== undefined && link.to < link.from) throw new UsageError(`--region ${spec}: the later year first`, { code: "history.region.years" });
  return link;
}

const KIND_OPT = { name: "kind", type: "string" as const, value: "<kind>", description: `what kind of event: ${EVENT_KINDS.join(", ")}` };
const YEAR_OPTS = [
  { name: "from", type: "string" as const, value: "<year>", description: "the year it began" },
  { name: "to", type: "string" as const, value: "<year>", description: "the year it ended (default: --from)" },
  { name: "date", type: "string" as const, value: "<ISO>", description: "the day or month, only when it is sure (1866-07-03, 1866-07)" },
];
const SAME_OPTS = [
  { name: "same-as", type: "string" as const, value: "<event>", description: "it is that event (one more source of it)" },
  { name: "distinct", type: "string" as const, value: "<why>", description: "another event than those of the same kind and years: why" },
  { name: "replaces", type: "string" as const, value: "<event>", description: "it takes the place of that event (taken back; what the person hid holds on this one)" },
];
const textOpts = (name: string, what: string) => REGION_LANGS.map((l) => ({ name: `${name}-${l}`, type: "string" as const, value: "<text>", description: `${what} (${l})` }));

/** A region's name in the research's language (its ID when it has no catalog). */
function regionText(ctx: Context, tree: Tree, id: string): string {
  const sh = ctx.settings.shared()?.value;
  const c = sh && regionIdOk(id) ? readCatalog(sh, id) : undefined;
  return c?.region.name[tree.lang] ?? c?.region.name.en ?? id;
}

function agentWork(ctx: Context, what: string): Tree {
  const tree = ctx.tree();
  refuseInArchive(tree, what, ctx.settings.agent(tree.config).value);
  return tree;
}

register(
  {
    path: ["history", "status"],
    summary: "The events of history at the tree's places: on or off, the places waiting, the regions and their catalogs",
    group: "history",
    tree: true,
    hidden: true,
    options: [{ name: "app", type: "boolean", description: "the whole answer the Strom app reads (with --json)" }],
    examples: ["strom history status", "strom history status --json"],
    run(ctx, { opts }) {
      const tree = ctx.tree();
      const sh = ctx.settings.shared()?.value;
      if (opts.app) {
        const answer = historyAnswer(tree, sh, ctx.settings);
        return { text: `${answer.events.length} events at ${Object.keys(answer.places).length} places; search ${answer.state.search}; rev ${answer.state.rev}`, data: answer };
      }
      const s = historyStatus(tree, sh, ctx.settings);
      const state = historyAnswer(tree, sh, ctx.settings).state;
      const shown = s.places.pending.slice(0, ctx.limit);
      // the tasks of history not finished, to start one by its ID (strom run --task T…), and when strom run takes the next
      const turn = s.on ? historyTurn(tree, sh, ctx.settings) : undefined;
      // in the order strom run takes them: the places first, the region asked for, then by their weight in the tree
      const order = historyOrder(turn);
      const tasks = tree
        .list<Task>("task")
        .filter((t) => forHistory(t) && ["open", "doing", "parked", "waiting"].includes(t.state))
        .sort((a, b) => order(a) - order(b) || a.created.localeCompare(b.created));
      // those strom run does not take now (a region skipped, another tree's, the experiment off, an archive): apart, with why
      const held = historyHeld(tree, sh, ctx.settings);
      const heldWhy = { skipped: "skipped by the person", held: "another research builds it", off: "history off", archive: "an archive", nobody: "nobody of the tree lived there in its years" } as const;
      const taken = tasks.filter((t) => !held(t));
      const apart = tasks.filter((t) => !!held(t));
      const weight = new Map((turn?.order ?? []).map((w) => [w.id, w]));
      const why = (t: Task): string => {
        const region = regionOfTask(t);
        const w = region ? weight.get(region) : undefined;
        if (turn?.asked?.task === t.id) return "asked first";
        if (turn?.placeAsked?.task === t.id) return `asked for by the person: ${turn.placeAsked.place}`;
        if (turn?.prefer?.task === t.id) return `first: ${turn.prefer.place}`;
        const gaps = forGaps(t) ? `years ${gapsOfTask(t).map(gapText).join(", ")}` : "";
        return [gaps, w ? `${w.persons} people, ${w.facts} facts` : ""].filter(Boolean).join(" · ");
      };
      const when = !turn ? undefined : turn.places ? `the next session, the places to map first (${turn.places})` : turn.pace === "idle" ? "when the family research has nothing to do" : turn.now ? "the next session" : `in ~${Math.max(1, turn.in ?? 0)} sessions`;
      return {
        text: lines(
          `history of the regions: ${s.switches.regions ? "on" : "off"} · of the places: ${s.switches.places ? "on" : "off"}${s.on ? "" : " (the user alone turns them on: strom config set experiments.history|experiments.placeHistory on [--for-tree])"} · search: ${state.search}${state.why ? ` (${state.why})` : ""}`,
          `places of the facts: ${s.places.total} · mapped ${s.places.mapped}${s.places.manual ? ` (${s.places.manual} by the person)` : ""} · not located ${s.places.unlocated} · waiting ${s.places.pending.length}${s.places.skipped ? ` · skipped by the person ${s.places.skipped}` : ""}`,
          shown.length ? `waiting: ${shown.join(" · ")}${s.places.pending.length > shown.length ? ` … (+${s.places.pending.length - shown.length}, --limit)` : ""}` : undefined,
          s.regions.length
            ? table(
                s.regions.map((r) => [
                  r.id,
                  r.name?.en ?? "(no catalog)",
                  `${r.events} events`,
                  r.retracted ? `${r.retracted} taken back` : "",
                  r.deleted ? `${r.deleted} deleted by the person` : "",
                  r.skipped ? "skipped by the person" : r.done ? `done ${r.done.slice(0, 10)}` : r.heldBy ? `held by ${r.heldBy}` : "open",
                  r.nobody ? "nobody of the tree lived there in its years" : r.period.length ? `period ${r.period.map(gapText).join(", ")}` : "",
                  r.added?.length ? `not looked through: ${r.added.map(gapText).join(", ")}` : "",
                  r.gaps?.length ? `gaps: ${r.gaps.map(gapText).join(", ")}` : "",
                  r.tried ? `${r.tried} pages not read` : "",
                ]),
              )
            : "no regions yet",
          s.ownPlaces.length
            ? lines(
                `the history of single places (strom history place L…: the person's word${ctx.settings.historyPlacesAuto(tree.config) ? "; each with coordinates by itself: on" : ""}):`,
                table(s.ownPlaces.map((p) => [`  ${p.id}`, p.key, p.history, `${p.events} events`, p.deleted ? `${p.deleted} deleted by the person` : "", p.done ? `done ${p.done.slice(0, 10)}` : p.heldBy ? `held by ${p.heldBy}` : ""])),
              )
            : undefined,
          `local events: ${s.local.events}${s.local.retracted ? ` (${s.local.retracted} taken back)` : ""}${s.local.deleted ? ` (${s.local.deleted} deleted by the person)` : ""} · hidden by the person: ${s.hidden.total}`,
          turn ? `pace: ${turn.pace} (strom config set experiments.historyPace sometimes|rare|idle) · ${turn.since} sessions since the last of history · strom run takes the next: ${when}${turn.asked ? ` · first: ${turn.asked.task} (asked for ${turn.asked.region})` : turn.prefer ? ` · first: ${turn.prefer.task} (a recent session worked at ${turn.prefer.place})` : ""}` : undefined,
          taken.length
            ? lines("tasks of history in the order strom run takes them, one a turn (strom run --task <T…> starts one now):", table(taken.map((t, i) => [`  ${i + 1}.`, t.id, t.origin, t.state, why(t)])))
            : apart.length
              ? undefined
              : s.on
              ? "no tasks of history yet: strom raises them when the next session of the research ends"
              : undefined,
          apart.length ? lines("not taken now:", table(apart.map((t) => ["  –", t.id, t.origin, t.state, heldWhy[held(t)!]]))) : undefined,
        ),
        data: { ...s, state, tasks: [...taken, ...apart].map((t) => ({ id: t.id, origin: t.origin, state: t.state, what: t.what, ...(held(t) ? { held: held(t) } : {}), ...(regionOfTask(t) && weight.has(regionOfTask(t)!) ? { weight: weight.get(regionOfTask(t)!) } : {}) })), ...(turn ? { turn } : {}) },
      };
    },
  },
  {
    path: ["history", "region"],
    summary: "Make a region of history (its names in cs, en, de), or change its names",
    group: "history",
    tree: true,
    hidden: true,
    description: "A region is a land whose events hold for its places in the years they belonged to it (strom history map). Its catalog is shared by every research on this computer.",
    args: [{ name: "region", description: "its ID: a–z, 0–9 and hyphens (e.g. cz-bohemia)", required: true }],
    options: textOpts("name", "its name"),
    examples: ['strom history region cz-bohemia --name-cs "Čechy" --name-en "Bohemia" --name-de "Böhmen"'],
    run(ctx, { args, opts }) {
      agentWork(ctx, "strom history region");
      const id = args[0]!.trim();
      const name = texts(opts, "name");
      const c = ensureRegion(shared(ctx), id, name);
      return { text: `${c.region.id}: ${c.region.name.en ?? ""} · ${c.events.length} events${c.done ? " · done" : ""}`, data: { region: c.region, events: c.events.length, done: c.done } };
    },
  },
  {
    path: ["history", "map"],
    summary: "A place of the tree's facts: the regions it belonged to, with the years — or not located",
    group: "history",
    tree: true,
    writes: true,
    hidden: true,
    description:
      "The place as the facts write it (strom history status lists those waiting). Each --region <id>[:<from>-<to>] once for each\n" +
      "land the place belonged to (a border moved: two regions with their years). A new region needs its names (--name-cs/en/de).",
    args: [{ name: "place", description: "the place, as the facts write it", required: true }],
    options: [
      { name: "region", type: "string", multiple: true, value: "<id>[:<from>-<to>]", description: "a region it belonged to, with the years (repeatable)" },
      { name: "also", type: "string", multiple: true, value: "<name>", description: "another name of the place (another language, a historical name; repeatable)" },
      { name: "unlocated", type: "boolean", description: "the place cannot be located" },
      { name: "why", type: "string", value: "<text>", description: "why it cannot be located" },
      ...textOpts("name", "the name of a new region"),
    ],
    examples: ['strom history map "Lhota" --region cz-bohemia:1850-1918 --region cz-czechoslovakia:1918-', 'strom history map "Lhota u Brna" --unlocated --why "two villages of the name"'],
    run(ctx, { args, opts }) {
      const tree = agentWork(ctx, "strom history map");
      const key = factPlaceKey(tree, args[0]!);
      if (!key) throw new UsageError(`"${args[0]}" is no place of the tree's facts`, { code: "history.place", params: { place: args[0]! }, hint: "strom history status lists the places waiting, as the facts write them" });
      if (opts.unlocated) {
        if (listOpt(opts.region).length) throw new UsageError("--unlocated or --region, not both", { code: "history.map" });
        const m = mapPlace(tree, key, { unlocated: true, ...(str(opts.why) ? { why: str(opts.why)! } : {}) });
        return { text: lines(...tree.written.map((o) => o.summary)), data: { place: key, map: m } };
      }
      const links = listOpt(opts.region).map(regionLink);
      if (!links.length) throw new UsageError("--region <id>[:<from>-<to>] (or --unlocated)", { code: "history.map" });
      const sh = shared(ctx);
      const missing = [...new Set(links.map((l) => l.id))].filter((id) => !readCatalog(sh, id));
      const name = texts(opts, "name");
      if (missing.length > 1 || (missing.length === 1 && !name))
        throw new UsageError(`no region ${missing.join(", ")} yet`, { code: "history.region.missing", params: { region: missing.join(", ") }, hint: `strom history region ${missing[0]} --name-cs "…" --name-en "…" --name-de "…" (or one new region here with --name-cs/en/de)` });
      if (!missing.length && name) throw new UsageError("--name-cs/en/de name a new region: every region given is there", { code: "history.region.names", hint: "strom history region <id> --name-… changes a region's names" });
      if (missing.length === 1 && name) {
        checkTexts("name", name, REGION_LANGS, 120, false);
        if (!tree.dryRun) ensureRegion(sh, missing[0]!, name);
      }
      const m = mapPlace(tree, key, { regions: links, also: listOpt(opts.also) });
      return { text: lines(...tree.written.map((o) => o.summary), missing.length && tree.dryRun ? `would make the region ${missing[0]}` : undefined), data: { place: key, map: m } };
    },
  },
  {
    path: ["history", "add"],
    summary: "An event of a region's history, from a page strom reads itself: the quoted words with the year must be on it",
    group: "history",
    tree: true,
    hidden: true,
    description:
      "strom reads the page (https, HTML or text) and finds the quote on it — word for word, a part left out as …, the year of the\n" +
      "event in it; a period whose page says its end apart: a second --quote with that year. The page's words as strom reads\n" +
      "them: strom history page <url> --find \"<words>\". A page strom cannot read: another source, or the event left out (the\n" +
      "person is asked nothing for it).\n" +
      "Texts in cs, en and de, each at most 300 characters, impersonal (what is, not what to do). The same kind and years as an\n" +
      "event there: --same-as (one more source), --distinct \"<why>\", or --replaces.\n" +
      "--place L…: an event of that place and its surroundings (its own catalog) in place of a region's; one of its regions' of\n" +
      "the same kind and years is there already: refused (the region's shows at the place). After it: the people it shows at.",
    options: [
      { name: "region", type: "string", value: "<id>", description: "the region" },
      { name: "place", type: "string", value: "<L…>", description: "or the place (its record): an event of the place and its surroundings" },
      ...YEAR_OPTS,
      KIND_OPT,
      ...textOpts("text", "what happened"),
      { name: "url", type: "string", value: "<https://…>", description: "the page it stands on" },
      { name: "quote", type: "string", multiple: true, value: "<words>", description: "the words of the page (≤ 300 characters each; the year it began in one, the year it ended in one; repeatable)" },
      { name: "title", type: "string", value: "<text>", description: "the page's title (default: its own)" },
      { name: "publisher", type: "string", value: "<text>", description: "who published it" },
      ...textOpts("why", "why it matters for the people of the place"),
      ...textOpts("tip", "where the research may look because of it"),
      { name: "sensitive", type: "boolean", description: "a hard event (a persecution, a famine): the app shows it with care" },
      ...SAME_OPTS,
    ],
    examples: [
      'strom history add --region cz-bohemia --from 1866 --kind epidemic --text-cs "…" --text-en "…" --text-de "…" --url https://example.org/cholera --quote "In 1866 cholera …"',
      'strom history add --region cz-bohemia --from 1914 --to 1918 --kind war --text-cs "…" --text-en "…" --text-de "…" --url https://example.org/war --quote "The war began in 1914 …" --quote "… it ended in 1918"',
      'strom history add --place L0003 --from 1842 --kind disaster --text-cs "…" --text-en "…" --text-de "…" --url https://example.org/fire --quote "In 1842 a fire …"',
    ],
    async run(ctx, { opts }) {
      const tree = agentWork(ctx, "strom history add");
      requireHistoryOn(tree, ctx.settings);
      const sh = shared(ctx);
      const region = str(opts.region)?.trim();
      const placeId = str(opts.place);
      if (region && placeId) throw new UsageError("--region or --place, not both", { code: "history.add.where" });
      const place = placeId ? requirePlace(tree, normId(placeId, "place")) : undefined;
      if (!region && !place) throw new UsageError("--region is missing (or --place L… for an event of a place and its surroundings)", { code: "history.region.missing" });
      if (region) {
        requireRegionId(region);
        if (!readCatalog(sh, region)) throw new UsageError(`there is no region ${region} yet`, { code: "history.region.missing", params: { region }, hint: `strom history region ${region} --name-cs "…" --name-en "…" --name-de "…"` });
      }
      const from = year(opts.from, "from");
      if (from === undefined) throw new UsageError("--from is missing: the year it began", { code: "history.years" });
      const to = year(opts.to, "to") ?? from;
      const date = str(opts.date);
      checkYears(from, to, date);
      const kind = checkKind(str(opts.kind) ?? "");
      const text = texts(opts, "text") ?? {};
      checkTexts("text", text, REGION_LANGS);
      const why = texts(opts, "why");
      const tip = texts(opts, "tip");
      if (why) checkTexts("why", why, REGION_LANGS);
      if (tip) checkTexts("tip", tip, REGION_LANGS);
      const url = str(opts.url);
      const quotes = listOpt(opts.quote).filter((q) => q.trim());
      if (!url || !quotes.length) throw new UsageError("--url and --quote: the page the event stands on and its words", { code: "history.source" });
      const shape = quotesShape(quotes, { from, to });
      if (shape) throw new UsageError(`--quote: ${shape}`, { code: "history.quote", params: { why: shape } });
      const s = sameness(opts);
      // a session filling a finished catalog's gaps: an event of those years alone, before any request
      const own = currentSession(tree, ctx.env, ctx.refs)?.task;
      const ownTask = own ? tree.get<Task>(own) : undefined;
      if (region && ownTask && forGaps(ownTask) && regionOfTask(ownTask) === region) {
        const gaps = gapsOfTask(ownTask);
        if (gaps.length && !gaps.some((g) => from <= g.to && g.from <= to)) {
          // its years said as they are: never looked through (K2.7), gaps (K2.6), or both
          const added = yearsToSearch(tree, sh, region).added;
          const fresh = gaps.filter((g) => added.some((a) => g.from <= a.to && a.from <= g.to));
          const holes = gaps.filter((g) => !fresh.includes(g));
          const span = from === to ? `${from}` : `${from}–${to}`;
          const said = !fresh.length
            ? `fills the gaps of ${region} only (${holes.map(gapText).join(", ")})`
            : !holes.length
              ? `looks through the years of ${region} never looked through only (${fresh.map(gapText).join(", ")})`
              : `looks for ${region} in these years only (never looked through ${fresh.map(gapText).join(", ")}; gaps ${holes.map(gapText).join(", ")})`;
          throw new UsageError(`this session ${said}: ${span} is outside them`, {
            code: "history.gaps.outside",
            params: { region },
          });
        }
      }
      if (place) refusePlaceBeforePage(tree, sh, place, { kind, from, to }, s, url);
      else {
        refuseBeforePage(sh, region!, { kind, from, to }, s, url);
        if (!s.sameAs && !s.distinct) refusePlaceSame(tree, sh, region!, { kind, from, to });
      }
      let checked;
      try {
        checked = await checkQuotes(url, quotes, { from, to }, sh, ctx.env);
      } catch (e) {
        if (e instanceof PageError) {
          if (place) notePlaceTried(sh, placeKeyOf(tree, place), url, e.why);
          else noteTried(sh, region!, url, e.why);
        }
        throw e;
      }
      const host = new URL(url).hostname;
      const source = {
        title: cleanText(str(opts.title) ?? checked.page.title ?? host),
        ...(str(opts.publisher) ? { publisher: cleanText(str(opts.publisher)!) } : {}),
        url,
        ...(checked.page.lang ? { lang: checked.page.lang } : {}),
        checked: checked.checked,
        quote: mainQuote(quotes, from),
        ...(quotes.length > 1 ? { quotes: quotes.map(cleanText) } : {}),
        sha: checked.page.sha,
      };
      const event = { from, to, ...(date ? { date } : {}), kind, text, ...(why ? { why } : {}), ...(tip ? { tip } : {}), ...(opts.sensitive ? { sensitive: true } : {}), source };
      // a place looked for before its region (K7.1a): its own events checked again once the page is read
      if (!place && !s.sameAs && !s.distinct) refusePlaceSame(tree, sh, region!, { kind, from, to });
      const r = place ? addPlaceEvent(tree, sh, place, event, s) : addRegionEvent(sh, tree.config.id, { region: region!, ...event }, s);
      const where = place ? `at ${placeLabel(place, "en")} (${place.id}) and its surroundings` : `in ${region}`;
      // who it shows at (their person in the Strom app, their story): for the agent to say to the person who asked
      const seen = whoSees(tree, sh, r.id);
      const shows = seen.length
        ? `shows at ${seen.length} ${seen.length === 1 ? "person" : "persons"} of the tree: ${seen.slice(0, 10).join(", ")}${seen.length > 10 ? ` … (+${seen.length - 10})` : ""}`
        : "shows at no person of the tree yet: nobody's facts at its places fall in its years (strom history where <year> --place …)";
      return {
        text: r.same ? lines(`${r.id}: one more source of it (${url})`, shows) : lines(`${r.id}: ${kind} ${from === to ? from : `${from}–${to}`} ${where} (the quote found on ${host})`, r.replaced ? `${r.replaced} taken back: ${r.id} takes its place` : undefined, shows),
        data: { ...r, persons: seen },
      };
    },
  },
  {
    path: ["history", "page"],
    summary: "A page as strom reads it for an event of history: its text in parts, or with --find the passages with the words to quote",
    group: "history",
    tree: true,
    hidden: true,
    description:
      "strom reads the page once (https, HTML or text; the server's pace, its robots.txt) and keeps it 30 days: strom history add\n" +
      "checks the quote on the same read. The text is the page's own words as strom compares the quote with them — copy them\n" +
      "word for word. --page <n>: its next part. A page strom cannot read: another source, or the event left out.",
    args: [{ name: "url", description: "the page (https://…)", required: true }],
    options: [
      { name: "find", type: "string", multiple: true, value: "<words>", description: "only the passages with these words (any case, any accent; repeatable)" },
      { name: "region", type: "string", value: "<id>", description: "the region it is read for (default: the session's) — a page strom cannot read is kept with it" },
      { name: "place", type: "string", value: "<L…>", description: "or the place it is read for (default: the session's)" },
    ],
    examples: ['strom history page https://example.org/cholera --find "1866"', "strom history page https://example.org/cholera --page 2"],
    async run(ctx, { args, opts }) {
      const tree = agentWork(ctx, "strom history page");
      requireHistoryOn(tree, ctx.settings);
      const sh = shared(ctx);
      const url = args[0]!.trim();
      const given = str(opts.region)?.trim();
      if (given) requireRegionId(given);
      const own = currentSession(tree, ctx.env, ctx.refs)?.task;
      const ownTask = own ? tree.get<Task>(own) : undefined;
      const placeGiven = str(opts.place);
      const region = given ?? (placeGiven ? undefined : ownTask ? regionOfTask(ownTask) : undefined);
      const placeOwn = placeGiven ? normId(placeGiven, "place") : !given && ownTask ? placeOfTask(ownTask) : undefined;
      const place = placeOwn ? requirePlace(tree, placeOwn) : undefined;
      let page;
      try {
        page = await readPage(url, sh, ctx.env);
      } catch (e) {
        if (!(e instanceof PageError)) throw e;
        if (region) noteTried(sh, region, url, e.why);
        else if (place) notePlaceTried(sh, placeKeyOf(tree, place), url, e.why);
        throw new PageError(url, e.why, "");
      }
      const head = `${page.title ?? new URL(url).hostname} — ${url} (${page.lang ? `${page.lang}, ` : ""}read ${page.at.slice(0, 10)})`;
      const base = { url, ...(page.title ? { title: page.title } : {}), ...(page.lang ? { lang: page.lang } : {}), read: page.at, chars: [...page.text].length };
      const parts = pageParts(page.text);
      const finds = listOpt(opts.find).filter((f) => f.trim());
      if (finds.length) {
        const { passages, more } = findPassages(page.text, finds, Math.min(ctx.limit, 20));
        const what = finds.map((f) => `"${f}"`).join(", ");
        return {
          text: lines(
            head,
            passages.length
              ? `${passages.length}${more ? ` of ${passages.length + more}` : ""} ${passages.length + more === 1 ? "passage" : "passages"} with ${what} — the page's own words (around one: --page <part>):`
              : `no passage with ${what} on the page as strom reads it (${parts.length} parts: --page <n>) — other words, or another source`,
            ...passages.map((p) => `[part ${p.part}] ${p.text}`),
            more ? `… ${more} more (--limit, or fewer words)` : undefined,
          ),
          data: { ...base, parts: parts.length, find: finds, passages, more },
        };
      }
      const n = Math.min(ctx.page, Math.max(1, parts.length));
      const part = parts[n - 1];
      return {
        text: lines(
          `${head} · ${base.chars} characters, part ${n} of ${parts.length}${n < parts.length ? ` (the next: --page ${n + 1})` : ""}`,
          part?.text || "(no text on the page)",
        ),
        data: { ...base, parts: parts.length, part: n, partChars: PART_CHARS, text: part?.text ?? "" },
      };
    },
  },
  {
    path: ["history", "local"],
    summary: "A local event the research read in one of its own sources (a fire, a flood, a note in a register)",
    group: "history",
    tree: true,
    writes: true,
    hidden: true,
    description:
      "The source with its image and its transcript, the event's years within the source's. The place is its record set's (or\n" +
      "--place). The text in the research language (--text), more languages with --text-cs/en/de.",
    options: [
      { name: "source", type: "string", value: "<S…>", description: "the source it is read in" },
      { name: "clip", type: "string", value: "<mark>", description: "its excerpt (strom source show lists the marks)" },
      { name: "place", type: "string", value: "<place>", description: "where it happened (default: the record set's place)" },
      ...YEAR_OPTS,
      KIND_OPT,
      { name: "text", type: "string", value: "<text>", description: "what happened, in the research language (≤ 300 characters)" },
      ...textOpts("text", "what happened"),
      ...SAME_OPTS,
    ],
    examples: ['strom history local --source S0001 --from 1842 --kind disaster --text "…"'],
    run(ctx, { opts }) {
      const tree = agentWork(ctx, "strom history local");
      requireHistoryOn(tree, ctx.settings);
      const id = normId(str(opts.source) ?? "", "source");
      const src = id ? tree.get<Source>(id) : undefined;
      if (!src || src.type !== "source") throw new UsageError(`there is no source ${opts.source ?? ""}`, { code: "history.local.source", hint: "--source S…" });
      if (src.retracted) throw new UsageError(`${id} is taken back`, { code: "history.local.source" });
      if (!src.media?.length && !src.clips?.length) throw new UsageError(`${id} has no image: a local event is read in the record itself`, { code: "history.local.image" });
      if (!src.transcript?.trim()) throw new UsageError(`${id} has no transcript: what it says is written first (strom source transcript)`, { code: "history.local.transcript" });
      const clip = str(opts.clip);
      if (clip && !(src.clips ?? []).some((c) => clipMark(c) === clip.trim())) throw new UsageError(`${id} has no excerpt ${clip}`, { code: "history.local.clip", hint: `strom source show ${id}` });
      const from = year(opts.from, "from");
      if (from === undefined) throw new UsageError("--from is missing: the year it happened", { code: "history.years" });
      const to = year(opts.to, "to") ?? from;
      const date = str(opts.date);
      checkYears(from, to, date);
      const rs = src.recordset ? tree.get<RecordSet>(src.recordset) : undefined;
      const span = [...(src.date ? dateYears(src.date) : []), ...(() => {
        const y = parseYears(rs?.years);
        return y ? [y.from, y.to] : [];
      })()];
      if (!span.length) throw new UsageError(`${id} says no years (neither its date nor its record set's): the event's years are not checked against it`, { code: "history.local.years", hint: `strom source edit ${id} --date …` });
      const lo = Math.min(...span);
      const hi = Math.max(...span);
      if (from < lo || to > hi) throw new UsageError(`${from === to ? from : `${from}–${to}`} is not within the years of ${id} (${lo === hi ? lo : `${lo}–${hi}`})`, { code: "history.local.years" });
      const kind = checkKind(str(opts.kind) ?? "");
      const text: Texts = { ...(texts(opts, "text") ?? {}) };
      const own = str(opts.text);
      if (own) text[tree.lang] = own;
      if (!text[tree.lang]) throw new UsageError(`--text is missing: what happened, in the research language (${tree.lang})`, { code: "history.text.missing" });
      checkTexts("text", text, [tree.lang]);
      const place = str(opts.place) ?? rs?.places[0];
      if (!place) throw new UsageError(`${id} has no place (its record set none): --place`, { code: "history.local.place" });
      const r = addLocalEvent(tree, { source: id, ...(clip ? { clip: clip.trim() } : {}), from, to, ...(date ? { date } : {}), kind, text, place, cite: src.title }, sameness(opts));
      return { text: r.same ? `${r.id}: the same event` : lines(...tree.written.map((o) => o.summary)), data: r };
    },
  },
  {
    path: ["history", "retract"],
    summary: "Take back an event that was wrong: never shown again (what the person hid stays)",
    group: "history",
    tree: true,
    writes: true,
    hidden: true,
    args: [{ name: "event", description: "the event (a region's, a place's, or L… of the tree)", required: true }],
    options: [{ name: "why", type: "string", value: "<text>", description: "why it is taken back" }],
    examples: ['strom history retract cz-bohemia-0003 --why "the page says 1867"'],
    run(ctx, { args, opts }) {
      const tree = agentWork(ctx, "strom history retract");
      const id = args[0]!.trim();
      const local = /^L\d+$/u.test(id);
      if (!local && tree.dryRun) return { text: `would take back ${id}`, data: { id, scope: "region" } };
      const r = retractEvent(tree, local ? undefined : shared(ctx), id, str(opts.why) ?? "");
      return { text: local ? lines(...tree.written.map((o) => o.summary)) : `${id} taken back`, data: r };
    },
  },
  {
    path: ["history", "done"],
    summary: "A region's catalog finished (or a place's, L…): looked for again only on the person's word",
    group: "history",
    tree: true,
    hidden: true,
    args: [{ name: "region", description: "the region, or the place record L… (its history and surroundings looked through)", required: true }],
    examples: ["strom history done cz-bohemia", "strom history done L0003"],
    run(ctx, { args }) {
      const tree = agentWork(ctx, "strom history done");
      const region = args[0]!.trim();
      const sh = shared(ctx);
      if (/^L\d+$/iu.test(region)) {
        // a place looked through in a conversation (its session finishes it by strom session close --done)
        requireHistoryOn(tree, ctx.settings);
        const p = requirePlace(tree, normId(region, "place"));
        const key = ensurePlaceCatalog(sh, tree, p).place.key;
        const c = markPlaceDone(sh, key, tree.config.id)!;
        // its task waiting (asked for, or raised by itself) is done with it; one at work closes with its session
        raiseHistoryTasks(tree, sh, ctx.settings);
        return { text: `${p.id}: done (${c.events.filter((e) => !e.retracted).length} events)`, data: { place: p.id, key, done: c.done } };
      }
      // the years looked through: this tree's period (K2.7), the events written in them since its session's task was made
      const had = readCatalog(sh, region);
      const own = currentSession(tree, ctx.env, ctx.refs)?.task;
      const since = own ? tree.get<Task>(own)?.created : undefined;
      const c = markDone(sh, region, tree.config.id, had ? donePeriod(tree, had) : undefined, since);
      return { text: `${c.region.id}: done (${c.events.filter((e) => !e.retracted).length} events)`, data: { region: c.region.id, done: c.done } };
    },
  },
  {
    path: ["history", "redo"],
    summary: "Look for a region's events again (the person's word): those found stay",
    group: "history",
    tree: true,
    writes: true,
    hidden: true,
    person: "Look for the events of this region again?",
    args: [{ name: "region", description: "the region", required: true }],
    examples: ["strom history redo cz-bohemia"],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const id = args[0]!.trim();
      if (!regionIdOk(id)) requireRegionId(id);
      if (tree.dryRun) return { text: `would look for the events of ${id} again`, data: { region: id } };
      const c = redoRegion(shared(ctx), id);
      // its tasks at once: a task of its gaps waiting is done (the whole region is looked for), the region's raised
      raiseHistoryTasks(tree, ctx.settings.shared()?.value, ctx.settings);
      return { text: ui(tree.lang, "ui.history.past.redo", { region: c.region.name[tree.lang] ?? c.region.name.en ?? id }), data: { region: id } };
    },
  },
  {
    path: ["history", "first"],
    summary: "Look for a region's history first of the regions (the person's word): still at the turn of the pace",
    group: "history",
    tree: true,
    writes: true,
    hidden: true,
    person: "Look for the history of this region first?",
    description: "The region's task comes first of the regions (after the places to map) at history's next turn (experiments.historyPace); strom run --task T… takes it now. Only while the history of the places is on.",
    args: [{ name: "region", description: "the region (strom history status lists those of the tree)", required: true }],
    examples: ["strom history first cz-bohemia"],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const id = args[0]!.trim();
      const out = askFirst(tree, ctx.settings.shared()?.value, id, ctx.settings);
      const c = ctx.settings.shared()?.value ? readCatalog(ctx.settings.shared()!.value, id) : undefined;
      return { text: ui(tree.lang, "ui.history.past.first", { region: c?.region.name[tree.lang] ?? c?.region.name.en ?? id }), data: { region: id, ...(out.task ? { task: out.task } : {}), first: out.first } };
    },
  },
  {
    path: ["history", "place"],
    summary: "Look for the history of a place and its surroundings (the person's word): its task first of all, the next session",
    group: "history",
    tree: true,
    writes: true,
    hidden: true,
    person: "Look for the history of this place and its surroundings (one session of the agent)?",
    description:
      "The events of the place, its parish or estate and its surroundings (~10 km): fires, floods, battles nearby, changes of the\n" +
      "estate and the parish, the school, the chronicle. Its task comes before anything at the next session of strom run,\n" +
      "whatever the pace; a place looked for already is looked for again (its events stay). Its catalog is shared by every\n" +
      "research on this computer with the place (by its coordinates). Only while the history is on.",
    args: [{ name: "place", description: "the place record (L…; strom place list)", required: true }],
    examples: ["strom history place L0003"],
    refusesFirst(ctx) {
      refusePlaceAsk(ctx.tree(), ctx.settings);
    },
    run(ctx, { args }) {
      const tree = ctx.tree();
      const id = normId(args[0]!, "place");
      const out = askPlace(tree, ctx.settings.shared()?.value, id, ctx.settings);
      const p = requirePlace(tree, id);
      const est = placeEstimate(tree);
      return {
        text: lines(ui(tree.lang, out.again ? "ui.history.place.again" : "ui.history.place.asked", { place: placeLabel(p, tree.lang) }), `${out.task}: strom run takes it next (now: strom run --task ${out.task})`),
        data: { place: id, key: out.key, task: out.task, again: out.again, estimate: est },
      };
    },
  },
  {
    path: ["history", "area"],
    summary: "What a session on a place's history looked through: its parish, estate and surroundings (cs, en, de)",
    group: "history",
    tree: true,
    hidden: true,
    description: "Shown with the place in the Strom app. Each text at most 200 characters, impersonal (\"the parish of …, within 10 km\").",
    args: [{ name: "place", description: "the place record (L…)", required: true }],
    options: textOpts("text", "what was looked through"),
    examples: ['strom history area L0003 --text-cs "…" --text-en "…" --text-de "…"'],
    run(ctx, { args, opts }) {
      const tree = agentWork(ctx, "strom history area");
      requireHistoryOn(tree, ctx.settings, "places");
      const p = requirePlace(tree, normId(args[0]!, "place"));
      const area = texts(opts, "text");
      if (!area) throw new UsageError("--text-cs, --text-en and --text-de: what was looked through", { code: "history.area" });
      const c = setArea(tree, shared(ctx), p, area);
      return { text: `${p.id}: ${c.area?.en ?? ""}`, data: { place: p.id, key: c.place.key, area: c.area } };
    },
  },
  {
    path: ["history", "where"],
    summary: "Where an event of a year would show: the regions of the tree's places then, a place's own catalog, its people",
    group: "history",
    tree: true,
    hidden: true,
    description:
      "Before writing an event the person asked for (in a conversation too): the regions each place of the tree's facts belonged\n" +
      "to in that year, with their catalogs' events near it. --place: one place (as the facts write it, or its record L…) — its\n" +
      "regions then, its own catalog, its people and the years of their facts there.",
    args: [{ name: "year", description: "the year", required: true }],
    options: [{ name: "place", type: "string", value: "<place|L…>", description: "one place of the tree's facts, or its record" }],
    examples: ["strom history where 1866", 'strom history where 1842 --place "Lhota"', "strom history where 1842 --place L0003"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const y = year(args[0], "year");
      if (y === undefined) throw new UsageError("a year", { code: "history.years" });
      const sh = ctx.settings.shared()?.value;
      const maps = readPlaces(tree);
      const recordOf = placeRecordOf(tree.list<Place>("place"));
      const at = factsByRecord(tree);
      const given = str(opts.place)?.trim();
      // the places of the facts asked about: one (its words, or all those of its record), or every mapped one
      let keys: string[];
      if (given) {
        const rec = /^L\d+$/iu.test(given) ? requirePlace(tree, normId(given, "place")) : undefined;
        const key = rec ? undefined : factPlaceKey(tree, given);
        if (!rec && !key) throw new UsageError(`"${given}" is no place of the tree's facts`, { code: "history.place", params: { place: given }, hint: "strom history status (the places), strom place list (the records)" });
        keys = rec ? (at.get(rec.id)?.keys ?? []) : [key!];
      } else keys = Object.keys(maps).sort((a, b) => a.localeCompare(b));
      const regions = new Map<string, string[]>();
      const unmapped: string[] = [];
      for (const k of keys) {
        const m = maps[k];
        const links = m && m.state !== "unlocated" ? m.regions.filter((g) => inRegion({ from: y, to: y }, g)) : [];
        if (!links.length) unmapped.push(k);
        for (const g of links) regions.set(g.id, [...(regions.get(g.id) ?? []), k]);
      }
      const rows = [...regions].map(([id, places]) => {
        const c = sh ? readCatalog(sh, id) : undefined;
        const near = c?.events.filter((e) => !e.retracted && e.from <= y + 5 && e.to >= y - 5) ?? [];
        return { region: id, name: regionName(c, tree.lang, id), catalog: !!c, places, events: near.map((e) => ({ id: e.id, from: e.from, to: e.to, kind: e.kind })) };
      });
      const records = given ? [...new Set(keys.map((k) => recordOf(k)).filter((x): x is string => !!x))] : [];
      const own = records.map((id) => {
        const p = requirePlace(tree, id);
        const key = placeKeyOf(tree, p);
        const c = sh ? readPlaceCatalog(sh, key) : undefined;
        const span = yearsAt(at.get(id));
        return { place: id, name: placeLabel(p, tree.lang), key, events: c?.events.filter((e) => !e.retracted).length ?? 0, persons: at.get(id)?.persons.size ?? 0, ...(span ? { years: span } : {}) };
      });
      const few = (xs: string[], n: number) => `${xs.slice(0, n).join(", ")}${xs.length > n ? " …" : ""}`;
      return {
        text: lines(
          `the year ${y}:`,
          rows.length
            ? table(rows.map((r) => [`  ${r.region}`, r.name, `${r.places.length} ${r.places.length === 1 ? "place" : "places"}: ${few(r.places, 5)}`, r.catalog ? `${r.events.length} events within 5 years${r.events.length ? ` (${few(r.events.map((e) => e.id), 5)})` : ""}` : "no catalog yet"]))
            : "  no region of the tree's places holds that year (strom history status: the places to map)",
          unmapped.length ? `  not mapped for ${y}: ${few(unmapped, 10)}` : undefined,
          own.length
            ? table(own.map((o) => [`  ${o.place}`, o.name, `${o.persons} ${o.persons === 1 ? "person" : "persons"}${o.years ? ` (facts ${o.years.from}–${o.years.to})` : ""}`, `its own catalog: ${o.events} events`]))
            : undefined,
          "an event of a region: strom history add --region <id> …; of the place itself and its surroundings: strom history add --place <L…> …",
        ),
        data: { year: y, regions: rows, unmapped, places: own },
      };
    },
  },
  ...(["hide", "show"] as const).map((verb) => ({
    path: ["history", verb],
    summary:
      verb === "hide"
        ? "Hide an event at a place, a person or in the whole tree, or everything of a region (the person's choice)"
        : "Show again an event hidden at a place, a person or in the whole tree, or everything of a region",
    group: "history" as const,
    tree: true,
    writes: true,
    hidden: true,
    person: verb === "hide" ? "Hide this?" : "Show this again?",
    args: [{ name: "event", description: "the event (none with --region)" }],
    options: [
      { name: "place", type: "string" as const, value: "<place>", description: "at this place" },
      { name: "person", type: "string" as const, value: "<P…>", description: "at this person" },
      { name: "tree", type: "boolean" as const, description: "in the whole tree" },
      { name: "region", type: "string" as const, value: "<id>", description: "everything of this region (no event)" },
    ],
    examples: [`strom history ${verb} cz-bohemia-0003 --place "Lhota"`, `strom history ${verb} cz-bohemia-0003 --tree`, `strom history ${verb} --region cz-bohemia`],
    run(ctx: Context, { args, opts }: { args: string[]; opts: Record<string, unknown> }) {
      const tree = ctx.tree();
      const place = str(opts.place);
      const who = str(opts.person);
      const region = str(opts.region)?.trim();
      const event = args[0]?.trim() || undefined;
      const wheres = [place !== undefined, who !== undefined, !!opts.tree].filter(Boolean).length;
      if (region !== undefined ? event !== undefined || wheres > 0 : event === undefined || wheres !== 1)
        throw new UsageError("an event with --place, --person or --tree (one of them) — or --region alone", { code: "history.body" });
      let person: string | undefined;
      if (who !== undefined) {
        try {
          person = resolvePerson(tree, who).id;
        } catch {
          throw new UsageError(`there is no person ${who}`, { code: "history.person", params: { person: who } });
        }
      }
      const out = hideEvent(
        tree,
        ctx.settings.shared()?.value,
        region !== undefined ? { region } : { event, ...(place !== undefined ? { place } : person !== undefined ? { person } : { tree: true as const }) },
        verb === "show",
      );
      const changed = tree.written.length > 0;
      if (region !== undefined) {
        const name = regionText(ctx, tree, region);
        return { text: ui(tree.lang, changed ? (verb === "hide" ? "ui.history.past.region.hidden" : "ui.history.past.region.shown") : "ui.history.past.same.region", { region: name }), data: { hidden: out } };
      }
      const where = place ?? person ?? ui(tree.lang, "ui.history.past.where.tree");
      return { text: ui(tree.lang, changed ? (verb === "hide" ? "ui.history.past.hidden" : "ui.history.past.shown") : "ui.history.past.same", { event: event!, where }), data: { hidden: out } };
    },
  })),
  ...(["delete", "restore"] as const).map((verb) => ({
    path: ["history", verb],
    summary:
      verb === "delete"
        ? "Delete an event of history (the person's choice): a region's from every tree on this computer, a local one from this tree — never written again until restored"
        : "Restore an event of history the person deleted",
    group: "history" as const,
    tree: true,
    writes: true,
    hidden: true,
    person: verb === "delete" ? "Delete this event?" : "Restore this event?",
    description:
      verb === "delete"
        ? "A region's event goes from its catalog, shared by every research on this computer; the research never writes it again (an event of the same kind and years only from a page at another address). A local event (L…) goes from this tree only. strom history restore brings it back; one the research took back (strom history retract) is not the person's."
        : undefined,
    args: [{ name: "event", description: "the event (a region's, a place's, or L… of the tree)", required: true }],
    examples: [`strom history ${verb} cz-bohemia-0003`],
    run(ctx: Context, { args }: { args: string[]; opts: Record<string, unknown> }) {
      const tree = ctx.tree();
      const event = args[0]!.trim();
      const local = /^L\d+$/u.test(event);
      if (!local && tree.dryRun) return { text: `would ${verb} ${event}`, data: { event, scope: "region" } };
      const out = deleteEvent(tree, local ? undefined : shared(ctx), event, verb === "restore");
      const key = !out.changed ? "ui.history.past.skip.same" : verb === "restore" ? "ui.history.past.restored" : local ? "ui.history.past.deleted.local" : "ui.history.past.deleted.region";
      return { text: ui(tree.lang, key, { event }), data: { event, scope: out.scope, deleted: out.deleted } };
    },
  })),
  ...(["skip", "unskip"] as const).map((verb) => ({
    path: ["history", verb],
    summary:
      verb === "skip"
        ? "Look for no history of a region, or at a place, in this research (the person's choice): what was found stays"
        : "Look for the history of a region, or at a place, again",
    group: "history" as const,
    tree: true,
    writes: true,
    hidden: true,
    person: verb === "skip" ? "Look for no history here?" : "Look for the history here again?",
    description:
      verb === "skip"
        ? "A region: its tasks stay out of the queue and none is raised; its events found stay in its catalog (shared by every research on this computer). A place: no event of a region through it, no weight in the order, nothing to map."
        : undefined,
    options: [
      { name: "region", type: "string" as const, value: "<id>", description: "the region (strom history status lists those of the tree)" },
      { name: "place", type: "string" as const, value: "<place>", description: "the place, as the facts write it" },
    ],
    examples: [`strom history ${verb} --region cz-bohemia`, `strom history ${verb} --place "Lhota"`],
    run(ctx: Context, { opts }: { args: string[]; opts: Record<string, unknown> }) {
      const tree = ctx.tree();
      const region = str(opts.region)?.trim();
      const place = str(opts.place);
      if ((region === undefined) === (place === undefined)) throw new UsageError("--region or --place (one of them)", { code: "history.body" });
      const out = skipHistory(tree, region !== undefined ? { region } : { place: place! }, verb === "unskip");
      const changed = tree.written.length > 0;
      const key = !changed
        ? "ui.history.past.skip.same"
        : region !== undefined
          ? verb === "skip" ? "ui.history.past.skip.region" : "ui.history.past.unskip.region"
          : verb === "skip" ? "ui.history.past.skip.place" : "ui.history.past.unskip.place";
      return {
        text: ui(tree.lang, key, { region: region !== undefined ? regionText(ctx, tree, region) : "", place: place?.trim() ?? "" }),
        data: { skip: { regions: out.regions.map((x) => x.region), places: out.places.map((x) => x.place) } },
      };
    },
  })),
  {
    path: ["history", "assign"],
    summary: "A place's regions as the person knows them (the research never maps it otherwise) — or determined again, or back to the research",
    group: "history",
    tree: true,
    writes: true,
    hidden: true,
    person: "Change the regions of this place?",
    description:
      "--region <id>[:<from>-<to>] once for each region the place belonged to (the regions that exist: strom history status); --redo:\n" +
      "the research determines the place again at the next session of the places, with --note for it; --auto: back to what the\n" +
      "research determined before.",
    args: [{ name: "place", description: "the place, as the facts write it", required: true }],
    options: [
      { name: "region", type: "string", multiple: true, value: "<id>[:<from>-<to>]", description: "a region it belonged to, with the years (repeatable)" },
      { name: "redo", type: "boolean", description: "determined again by the research" },
      { name: "note", type: "string", value: "<text>", description: "with --redo: what the research should know (at most 200 characters)" },
      { name: "auto", type: "boolean", description: "back to what the research determined" },
    ],
    examples: ['strom history assign "Lhota" --region cz-bohemia:-1918 --region cz-czechoslovakia:1918-', 'strom history assign "Lhota" --redo --note "the one near the river"', 'strom history assign "Lhota" --auto'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const links = listOpt(opts.region).map(regionLink);
      const note = typeof opts.note === "string" ? opts.note : undefined;
      if ([links.length > 0, !!opts.redo, !!opts.auto].filter(Boolean).length !== 1)
        throw new UsageError("--region <id>[:<from>-<to>] (repeatable), --redo or --auto (one of them)", { code: "history.body" });
      if (note !== undefined && !opts.redo) throw new UsageError("--note goes with --redo", { code: "history.body" });
      const m = assignPlace(
        tree,
        ctx.settings.shared()?.value,
        args[0]!,
        links.length ? { regions: links } : opts.redo ? { redo: true, ...(note !== undefined ? { note } : {}) } : { auto: true },
      );
      const place = factPlaceKey(tree, args[0]!) ?? args[0]!;
      const text =
        tree.written.length === 0
          ? ui(tree.lang, "ui.history.past.skip.same")
          : links.length
            ? ui(tree.lang, "ui.history.past.assign", { place, regions: links.map((l) => `${regionText(ctx, tree, l.id)}${l.from !== undefined || l.to !== undefined ? ` ${l.from ?? "…"}–${l.to ?? "…"}` : ""}`).join(", ") })
            : ui(tree.lang, opts.redo ? "ui.history.past.assign.redo" : "ui.history.past.assign.auto", { place });
      // what the research had determined before the person's word stays inside (for --auto)
      const shown = m ? (({ auto: _auto, ...rest }) => rest)(m) : null;
      return { text, data: { place, map: shown } };
    },
  },
);

// ── strom history list: the events the research shows, readable in the terminal ──

const KIND_TEXT: Record<EventKind, UIKey> = {
  war: "ui.history.kind.war",
  epidemic: "ui.history.kind.epidemic",
  census: "ui.history.kind.census",
  state: "ui.history.kind.state",
  emigration: "ui.history.kind.emigration",
  law: "ui.history.kind.law",
  economy: "ui.history.kind.economy",
  disaster: "ui.history.kind.disaster",
  other: "ui.history.kind.other",
};

/** A hide of one event as the list gives it: at a place, at a person, in the whole tree, or everything of its region. */
type ListedHide = { place: string } | { person: string } | { tree: true } | { region: string };

/** One event of strom history list (--json): stable field names. */
interface ListedEvent {
  id: string;
  from: number;
  to: number;
  date?: string;
  kind: EventKind;
  scope: "region" | "place" | "local";
  /** In the research's language (else English, else the first it has). */
  text: string;
  region?: { id: string; name: string };
  place?: { key: string; id?: string; name: string };
  /** A page's source of a region's or a place's event. */
  source?: { title: string; publisher?: string; url: string };
  /** A local event: the research's source it was read in, and the place of that source. */
  local?: { source: string; title: string; place?: string };
  /** The places of the tree's facts it shows at. */
  at: string[];
  hidden?: ListedHide[];
  /** Deleted by the person: when. */
  deleted?: string;
}

const inLang = (t: Texts | undefined, lang: string): string => (t ? (t[lang] ?? t.en ?? Object.values(t)[0] ?? "") : "");

/** The events of historyAnswer (and those the person deleted) as the list gives them, each with what hides it. */
function listedEvents(tree: Tree, answer: ReturnType<typeof historyAnswer>): { events: ListedEvent[]; regionHidden: Set<string> } {
  const lang = tree.lang;
  const at = new Map<string, string[]>();
  for (const [k, p] of Object.entries(answer.places)) for (const id of p.events) at.set(id, [...(at.get(id) ?? []), k]);
  const sources = new Map(tree.list<Source>("source").map((s) => [s.id, s]));
  const localPlace = new Map(readLocal(tree).events.map((e) => [e.id, e.place]));
  const hides = new Map<string, ListedHide[]>();
  const regionHidden = new Set<string>();
  const personName = (id: string) => {
    const p = tree.get<Person>(id);
    return p ? `${displayName(p)} (${id})` : id;
  };
  for (const h of answer.hidden as Hide[]) {
    if (h.event === undefined) {
      if (h.region) regionHidden.add(h.region);
      continue;
    }
    const one: ListedHide = h.place !== undefined ? { place: h.place } : h.person !== undefined ? { person: h.person } : { tree: true };
    hides.set(h.event, [...(hides.get(h.event) ?? []), one]);
  }
  const listed = (id: string, e: Omit<AppEvent, "id" | "place">, place: AppEvent["place"] | undefined, localAt: string | undefined, deleted?: string): ListedEvent => {
    const hidden = [...(hides.get(id) ?? []), ...(e.region && regionHidden.has(e.region.id) ? [{ region: e.region.id }] : [])];
    const s = e.local ? sources.get(e.local.source) : undefined;
    return {
      id,
      from: e.from,
      to: e.to,
      ...(e.date ? { date: e.date } : {}),
      kind: e.kind,
      scope: e.scope,
      text: inLang(e.text, lang),
      ...(e.region ? { region: { id: e.region.id, name: inLang(e.region.name, lang) || e.region.id } } : {}),
      ...(place ? { place: { key: place.key, ...(place.id ? { id: place.id } : {}), name: inLang(place.name, lang) || place.key } } : {}),
      ...(e.source ? { source: { title: e.source.title, ...(e.source.publisher ? { publisher: e.source.publisher } : {}), url: e.source.url } } : {}),
      ...(e.local ? { local: { source: e.local.source, title: s?.title ?? e.local.cite, ...(localAt ? { place: localAt } : {}) } } : {}),
      at: at.get(id) ?? [],
      ...(hidden.length ? { hidden: hidden.map((h) => ("person" in h ? { person: personName(h.person) } : h)) } : {}),
      ...(deleted ? { deleted } : {}),
    };
  };
  const events = answer.events.map((e) => listed(e.id, e, e.place, localPlace.get(e.id)));
  for (const d of answer.deleted) {
    const { event, at: when, place, ...rest } = d;
    const obj = typeof place === "object" ? place : undefined;
    events.push(listed(event, rest, obj, typeof place === "string" ? place : localPlace.get(event), when));
  }
  return { events, regionHidden };
}

/** The group an event is listed under: its region, its place, or the research's own sources. */
function groupOf(e: ListedEvent): { key: string; order: number; name: string } {
  if (e.scope === "region" && e.region) return { key: `r:${e.region.id}`, order: 0, name: e.region.name };
  if (e.scope === "place" && e.place) return { key: `p:${e.place.id ?? e.place.key}`, order: 1, name: e.place.name };
  return { key: "l", order: 2, name: "" };
}

const yearsOf = (e: ListedEvent) => e.date ?? (e.from === e.to ? `${e.from}` : `${e.from}–${e.to}`);

register({
  path: ["history", "list"],
  summary: "The events of history the research shows at the tree's places, one line each: year, kind, text, source, hidden or deleted",
  group: "history",
  tree: true,
  hidden: true,
  description:
    "The events the Strom app shows (a region's by the years each place belonged to it, a place's own, the local ones read in\n" +
    "the research's sources), grouped by region and place, by year. Hidden by the person (at a place, a person, the whole tree,\n" +
    "everything of a region) and deleted ones marked. Read only; in an archive too, with the history off too (what was found\n" +
    "stays). --place: the events at one place (its record L…, or the place as the facts write it); --region: one region's.",
  options: [
    { name: "place", type: "string", value: "<L…|place>", description: "only the events at this place: its record (L…), or the place as the facts write it" },
    { name: "region", type: "string", value: "<id>", description: "only this region's events (strom history status lists the regions)" },
  ],
  examples: ["strom history list", "strom history list --place L0003", "strom history list --region cz-bohemia --json"],
  run(ctx, { opts }) {
    const tree = ctx.tree();
    const lang = tree.lang;
    const answer = historyAnswer(tree, ctx.settings.shared()?.value, ctx.settings);
    const { events: all, regionHidden } = listedEvents(tree, answer);
    let events = all;

    // --place: the events at its places of the facts, and those the person deleted there
    const givenPlace = str(opts.place)?.trim();
    let place: { id?: string; keys: string[] } | undefined;
    if (givenPlace) {
      const isRecord = /^L\d+$/iu.test(givenPlace);
      const rec = isRecord ? placeRecord(tree, normId(givenPlace, "place")) : undefined;
      const key = isRecord ? undefined : factPlaceKey(tree, givenPlace);
      if (!rec && !key)
        throw new UsageError(isRecord ? `there is no place ${givenPlace} in the research` : `"${givenPlace}" is no place of the tree's facts`, {
          code: "history.place",
          params: { place: givenPlace },
          hint: "strom place list (the place records), strom history status (the places of the facts)",
        });
      const fold = (k: string) => foldText(k);
      const wanted = new Set<string>(rec ? [...(factsByRecord(tree).get(rec.id)?.keys ?? []), ...Object.entries(answer.places).filter(([, p]) => p.id === rec.id).map(([k]) => k)].map(fold) : [fold(key!)]);
      const keys = Object.keys(answer.places).filter((k) => wanted.has(fold(k)));
      const links = keys.flatMap((k) => (answer.places[k] as AppPlace).regions ?? []);
      place = { ...(rec ? { id: rec.id } : {}), keys };
      events = events.filter((e) => {
        if (!e.deleted) return e.at.some((k) => wanted.has(fold(k)));
        if (e.scope === "place") return !!rec && e.place?.id === rec.id;
        if (e.scope === "local") return !!e.local?.place && wanted.has(fold(e.local.place));
        return links.some((g) => g.id === e.region?.id && inRegion(e, g));
      });
    }
    // --region: that region's events
    const region = str(opts.region)?.trim();
    if (region !== undefined) {
      if (!regionIdOk(region) || !answer.regions[region])
        throw new UsageError(`no region ${region} at the places of the tree`, { code: "history.region.unknown", params: { region }, hint: "strom history status lists the regions of the tree" });
      events = events.filter((e) => e.scope === "region" && e.region?.id === region);
    }

    const sorted = [...events].sort((a, b) => {
      const [ga, gb] = [groupOf(a), groupOf(b)];
      return ga.order - gb.order || ga.name.localeCompare(gb.name) || ga.key.localeCompare(gb.key) || a.from - b.from || a.to - b.to || a.id.localeCompare(b.id);
    });
    const page = paginate(sorted, ctx.limit, ctx.page);
    const on = historyOn(tree, ctx.settings);

    const out: string[] = [];
    let group = "";
    let rows: string[][] = [];
    const flush = () => {
      if (rows.length) out.push(table(rows));
      rows = [];
    };
    for (const e of page.items) {
      const g = groupOf(e);
      if (g.key !== group) {
        flush();
        group = g.key;
        out.push(
          e.scope === "region" && e.region
            ? `${ui(lang, "ui.history.list.region", { region: `${e.region.name} (${e.region.id})` })}${regionHidden.has(e.region.id) ? ` · ${ui(lang, "ui.history.list.hidden.region")}` : ""}`
            : e.scope === "place" && e.place
              ? ui(lang, "ui.history.list.place", { place: `${e.place.name}${e.place.id ? ` (${e.place.id})` : ""}` })
              : ui(lang, "ui.history.list.local"),
        );
      }
      const source = e.source ? `${e.source.title}${e.source.publisher ? `, ${e.source.publisher}` : ""} <${e.source.url}>` : e.local ? `${e.local.title} (${e.local.source})${e.local.place ? ` · ${e.local.place}` : ""}` : "";
      const marks = [
        ...(e.hidden ?? []).flatMap((h) =>
          "place" in h ? [ui(lang, "ui.history.list.hidden.place", { place: h.place })] : "person" in h ? [ui(lang, "ui.history.list.hidden.person", { person: h.person })] : "tree" in h ? [ui(lang, "ui.history.list.hidden.tree")] : [],
        ),
        ...(e.deleted ? [ui(lang, "ui.history.list.deleted")] : []),
      ];
      rows.push([`  ${yearsOf(e)}`, ui(lang, KIND_TEXT[e.kind] ?? "ui.history.kind.other"), [`${e.text}${source ? ` — ${source}` : ""}`, e.id, ...marks.map((m) => `[${m}]`)].join(" · ")]);
    }
    flush();
    const command = `strom history list${givenPlace ? ` --place ${/\s/u.test(givenPlace) ? `"${givenPlace}"` : givenPlace}` : ""}${region ? ` --region ${region}` : ""}`;
    return {
      text: lines(on ? undefined : ui(lang, "ui.history.list.off"), sorted.length ? lines(...out, moreLine(page, command, lang) || undefined) : ui(lang, "ui.history.list.none")),
      data: {
        on,
        lang,
        ...(place ? { place } : {}),
        ...(region !== undefined ? { region } : {}),
        total: page.total,
        page: page.page,
        pages: page.pages,
        ...(answer.state.truncated ? { truncated: true } : {}),
        events: page.items,
      },
    };
  },
});

