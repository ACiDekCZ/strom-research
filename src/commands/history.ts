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
} from "../core/pastevents.ts";
import type { RecordSet, Source, Task } from "../core/model.ts";
import type { Tree } from "../core/tree.ts";

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
      const heldWhy = { skipped: "skipped by the person", held: "another research builds it", off: "history off", archive: "an archive" } as const;
      const taken = tasks.filter((t) => !held(t));
      const apart = tasks.filter((t) => !!held(t));
      const weight = new Map((turn?.order ?? []).map((w) => [w.id, w]));
      const why = (t: Task): string => {
        const region = regionOfTask(t);
        const w = region ? weight.get(region) : undefined;
        if (turn?.asked?.task === t.id) return "asked first";
        if (turn?.prefer?.task === t.id) return `first: ${turn.prefer.place}`;
        const gaps = forGaps(t) ? `years ${gapsOfTask(t).map(gapText).join(", ")}` : "";
        return [gaps, w ? `${w.persons} people, ${w.facts} facts` : ""].filter(Boolean).join(" · ");
      };
      const when = !turn ? undefined : turn.places ? `the next session, the places to map first (${turn.places})` : turn.pace === "idle" ? "when the family research has nothing to do" : turn.now ? "the next session" : `in ~${Math.max(1, turn.in ?? 0)} sessions`;
      return {
        text: lines(
          `history of the places: ${s.on ? "on" : "off (the user alone turns it on: strom config set experiments.history on)"} · search: ${state.search}${state.why ? ` (${state.why})` : ""}`,
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
                  r.period.length ? `period ${r.period.map(gapText).join(", ")}` : "",
                  r.added?.length ? `not looked through: ${r.added.map(gapText).join(", ")}` : "",
                  r.gaps?.length ? `gaps: ${r.gaps.map(gapText).join(", ")}` : "",
                  r.tried ? `${r.tried} pages not read` : "",
                ]),
              )
            : "no regions yet",
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
      "event there: --same-as (one more source), --distinct \"<why>\", or --replaces.",
    options: [
      { name: "region", type: "string", value: "<id>", description: "the region" },
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
    ],
    async run(ctx, { opts }) {
      const tree = agentWork(ctx, "strom history add");
      requireHistoryOn(tree, ctx.settings);
      const sh = shared(ctx);
      const region = str(opts.region);
      if (!region) throw new UsageError("--region is missing", { code: "history.region.missing" });
      requireRegionId(region);
      if (!readCatalog(sh, region)) throw new UsageError(`there is no region ${region} yet`, { code: "history.region.missing", params: { region }, hint: `strom history region ${region} --name-cs "…" --name-en "…" --name-de "…"` });
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
      if (ownTask && forGaps(ownTask) && regionOfTask(ownTask) === region) {
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
      refuseBeforePage(sh, region, { kind, from, to }, s, url);
      let checked;
      try {
        checked = await checkQuotes(url, quotes, { from, to }, sh, ctx.env);
      } catch (e) {
        if (e instanceof PageError) noteTried(sh, region, url, e.why);
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
      const r = addRegionEvent(sh, tree.config.id, { region, from, to, ...(date ? { date } : {}), kind, text, ...(why ? { why } : {}), ...(tip ? { tip } : {}), ...(opts.sensitive ? { sensitive: true } : {}), source }, s);
      return {
        text: r.same ? `${r.id}: one more source of it (${url})` : lines(`${r.id}: ${kind} ${from === to ? from : `${from}–${to}`} in ${region} (the quote found on ${host})`, r.replaced ? `${r.replaced} taken back: ${r.id} takes its place` : undefined),
        data: r,
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
      const region = given ?? (ownTask ? regionOfTask(ownTask) : undefined);
      let page;
      try {
        page = await readPage(url, sh, ctx.env);
      } catch (e) {
        if (!(e instanceof PageError)) throw e;
        if (region) noteTried(sh, region, url, e.why);
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
    args: [{ name: "event", description: "the event (a region's, or L… of the tree)", required: true }],
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
    summary: "A region's catalog finished: looked for again only on the person's word",
    group: "history",
    tree: true,
    hidden: true,
    args: [{ name: "region", description: "the region", required: true }],
    examples: ["strom history done cz-bohemia"],
    run(ctx, { args }) {
      const tree = agentWork(ctx, "strom history done");
      const region = args[0]!.trim();
      const sh = shared(ctx);
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
    args: [{ name: "event", description: "the event (a region's, or L… of the tree)", required: true }],
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

