// The brief of a session on the history of the places (the experiment experiments.history, core/pastevents.ts): a
// region's events looked for on the web, a place's own history and its surroundings, or the places of the facts mapped to regions — and, in a session that reads
// records, one line on the local events read in them. Only a brief of such a session speaks of it: the commands are
// behind the experiment's gate (hidden), the guide, help and strom commands say nothing of them.

import type { Place, Task } from "../core/model.ts";
import type { Tree } from "../core/tree.ts";
import { langName } from "../core/lang.ts";
import { foldText } from "../core/text.ts";
import { match } from "../cli/registry.ts";
import { synopsis } from "./sheet.ts";
import {
  catalogIds,
  EVENT_KINDS,
  forGaps,
  GAP_DENSITY,
  gapsOfTask,
  gapText,
  type Gap,
  HISTORY_PLACES_ORIGIN,
  HOLD_DAYS,
  placeNotes,
  readCatalog,
  readHidden,
  readPlaces,
  coveredBy,
  regionName,
  regionOfTask,
  regionPeriod,
  REGION_LANGS,
  LIVED_MARGIN,
  PRESENT_YEARS,
  searchedSpans,
  storyHistory,
  unmappedPlaces,
  historyPlaces,
} from "../core/pastevents.ts";
import type { Section } from "./brief.ts";
import { AREA_KM, defaultArea, factsByRecord, placeKeyOf, placeLabel, placeOfTask, placeRecord, readPlaceCatalog, regionEventsAt, yearsAt } from "../core/placehistory.ts";

/** About so many events a region at most: rather fewer. */
export const REGION_DENSITY = 60;
/** So many events written already, listed in the brief (the rest: strom history status). */
const EVENTS_SHOWN = 120;
/** So many places waiting, listed. */
const PLACES_SHOWN = 80;
const TEXT_SHOWN = 90;

/** One command line from the registry (every option and its value), or nothing when it is not registered. */
function cmd(words: string[]): string | undefined {
  const m = match(words);
  return m && m.used === words.length ? `  ${synopsis(m.def)}` : undefined;
}

function short(text: string, max = TEXT_SHOWN): string {
  const chars = [...text];
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : text;
}

function years(from: number, to: number): string {
  return from === to ? String(from) : `${from}–${to}`;
}

/** The web's rule of the brief's head in a session of history (in place of brief.ts webRule: no connector here). */
export const HISTORY_WEB_RULE = "Search the web freely; read each page through strom history page <url> (below), never the web fetch tool — no connector and no task in this session.";

const NOTHING_ELSE = "Nothing of it goes into the tree's records or the GEDCOM: no person, fact, source or search is written in this session.";

const ONLY_FROM_PAGES = [
  "- the source of each event: a page strom reads itself — strom history add downloads it, finds the quote on it (word for word, a part left out as …, the year in it) and refuses otherwise; strom checks every page, the person is asked nothing",
  "- find pages with your own web search; read each page with strom history page <url> (--find \"<words>\": only the passages with them; --page <n>: its next part) and quote the words it prints — never the web fetch tool (WebFetch) for a page: it gives a model's summary, its words are not the page's, and the page would be read twice; strom history add checks the quote on the same read, one request a page",
  "- a period: --from and --to as the page says them; the page says its end apart: a second --quote with that year (each ≤ 300 characters) — never a period shortened to fit one quote",
  "- prefer encyclopedias, state institutions, archives and the Wikipedia in the region's language with its references; a page strom cannot read (refused, a bot check, a PDF, a page made by a script, one that sends to a consent or login page of another site): another source, or the event left out — never ask the person, never strom allow, never a browser for it",
  "- this session writes events of history alone: no task (strom task add is refused here), no connector, nothing for the family research — many pages of one site go through strom history page, never a connector",
];

/**
 * The sections of a session on a task of history, after its header and its task: what it is for, what was found
 * already, the commands and how to finish. Undefined for any other task.
 */
export function historySections(tree: Tree, task: Task, shared: string | undefined, alone: boolean): Section[] | undefined {
  const region = regionOfTask(task);
  if (region) return regionSections(tree, region, shared, alone, forGaps(task) ? gapsOfTask(task) : undefined);
  if (task.origin === HISTORY_PLACES_ORIGIN) return placesSections(tree, shared, alone);
  const place = placeOfTask(task);
  if (place) return placeSections(tree, place, shared, alone);
  return undefined;
}

function closing(alone: boolean, lang: string, lines: string[]): Section {
  return {
    name: "closing",
    required: true,
    pointer: "",
    text: [
      "## Finishing",
      ...lines,
      alone
        ? `- the summary: plain words for the record (the menu, the Strom app), in ${langName(lang)}, never addressed to the user, no advice; after strom session close you are done: a last message of one line at most`
        : "- the user reads the summary (the menu, the Strom app): plain words, never addressed to them",
    ].join("\n"),
  };
}

/** What events a region's catalog keeps: those that shaped the lives of ordinary people there. */
const SHAPED =
  "those that shaped the lives of ordinary people there: wars and their levies, epidemics, famines, censuses, changes of the state and its borders, waves of emigration, laws on serfdom, land, schools, religion, great disasters; no lists of rulers, no battles far away, no happening of one village";

/** A region's session — or, with its gaps, a session filling the gaps of its finished catalog (K2.6). */
function regionSections(tree: Tree, region: string, shared: string | undefined, alone: boolean, gaps?: Gap[]): Section[] {
  const lang = tree.lang;
  const c = shared ? readCatalog(shared, region) : undefined;
  const name = regionName(c, lang, region);
  const period = regionPeriod(tree, region);
  // a task of years (K2.6, K2.7): those never looked through for (the period grew) apart from the gaps of the catalog
  const searched = gaps ? searchedSpans(tree, c) : [];
  const fresh = gaps?.filter((g) => !searched.some((s) => s.from <= g.from && g.to <= s.to)) ?? [];
  const empty = gaps?.filter((g) => !fresh.includes(g)) ?? [];
  const events = c?.events ?? [];
  const live = events.filter((e) => !e.retracted);
  // what the person hid in this tree: by event, and by kind (fewer of those kinds)
  const hides = readHidden(tree);
  const hiddenOf = new Map<string, number>();
  for (const h of hides) if (h.event !== undefined) hiddenOf.set(h.event, (hiddenOf.get(h.event) ?? 0) + 1);
  const byKind = new Map<string, number>();
  for (const e of events) if (hiddenOf.has(e.id)) byKind.set(e.kind, (byKind.get(e.kind) ?? 0) + hiddenOf.get(e.id)!);
  const room = Math.max(0, REGION_DENSITY - live.length);
  const span = (g: Gap) => g.to - g.from + 1;
  const wanted = gaps?.reduce((n, g) => n + Math.max(1, Math.round(span(g) / GAP_DENSITY)), 0) ?? 0;
  const out: Section[] = [];
  out.push({
    name: "history",
    required: true,
    pointer: "strom history status",
    text: [
      gaps
        ? fresh.length
          ? `## The years not looked through yet in the history of ${name} (${region}) — for the Strom app`
          : `## The gaps in the history of ${name} (${region}) — for the Strom app`
        : `## The history of ${name} (${region}) — for the Strom app`,
      "What the ancestors lived through: the events of this region's history, shown in the Strom app with the lives of the people of its places. " + NOTHING_ELSE,
      gaps
        ? [
            fresh.length
              ? `- the region's catalog is finished for the years looked through before; these years of this tree's people there were never looked through: ${fresh.map((g) => `${gapText(g)} (${span(g)} years)`).join(", ")}`
              : "",
            empty.length ? `- the region's catalog is finished, yet these years of this tree's people there have no event: ${empty.map((g) => `${gapText(g)} (${span(g)} years)`).join(", ")}` : "",
            "- look for events of these years alone (strom history add refuses others in this session); what the catalog has (below) is never looked for again",
          ]
            .filter(Boolean)
            .join("\n")
        : period.nobody
          ? "- period: none — the facts at this tree's places in the region all lie in other years: nobody of this tree lived there in its years; nothing to look for (strom session close --continue …, another task)"
          : period.undated
          ? `- period: ${period.from}–${period.to} — no fact at this tree's places in the region has a year: the years those places belonged to it (never before 1600), to the region's end (this year when it lasts)`
          : `- period: ${period.spans.map(gapText).join(", ")} — the years this tree's people lived at its places: their facts there, ${LIVED_MARGIN} years before and after, to this year only when the facts reach the last ${PRESENT_YEARS} years; look for events of these years alone; another tree sharing the region adds its own years later`,
      period.places.length
        ? `- this tree's places in it: ${period.places.map((p) => `${p.place}${p.from !== undefined || p.to !== undefined ? ` (${p.from ?? "…"}–${p.to ?? "…"})` : ""}${p.years.length ? ` facts ${years(Math.min(...p.years), Math.max(...p.years))}` : ""}`).join(" · ")}`
        : "",
      gaps
        ? `- how many: about one event every 10–15 years of each ${fresh.length ? "span of these years" : "gap"} (about ${wanted} in all) — ${SHAPED}; none documented worth writing: nothing — a year is never filled for its own sake`
        : `- how many: at most about ${REGION_DENSITY} events for the region, rather fewer (${live.length} written${room ? `, room for about ${room} more` : ": enough — only what is missing badly"}) — ${SHAPED}`,
      gaps ? "" : "- spread over the period: the people of every part of it lived through something — rather an event each 10–15 years of it than many of a few decades",
      `- kinds: ${EVENT_KINDS.join(", ")}`,
      `- each event: its years (the day only when sure: --date); its texts in ${REGION_LANGS.join(", ")}, each ≤ 300 characters — factual and impersonal: what happened, where, how many; never addressed to anyone, never what to do, never speaking as yourself; --why-*: why it mattered for the people of the place; --tip-*: where a research may look because of it (a kind of record, an archive's series), impersonal too`,
      "- a hard event (persecution, deportation, expulsion, famine, a pogrom): --sensitive; sober and factual, no judgement, no words of horror, and never a guess about the people of this tree — whom it touched is the reader's to see",
      ...ONLY_FROM_PAGES,
      "- the same event again (one more source): --same-as <event>; the same kind and years yet another event: --distinct \"<why>\"; a better one in the place of one written: --replaces <event> (what the person hid holds on it); one that was wrong: strom history retract <event> --why \"…\"",
    ].filter(Boolean).join("\n"),
  });
  const kinds = [...byKind.entries()].sort((a, b) => b[1] - a[1]);
  out.push({
    name: "events",
    first: true,
    pointer: "strom history status --app --json",
    text: [
      `## Events of ${region} written already (${live.length}${events.length > live.length ? `, ${events.length - live.length} taken back` : ""}) — never one again; another source of one: --same-as`,
      ...(events.length
        ? events.slice(0, EVENTS_SHOWN).map((e) => {
            const marks = [e.retracted?.by === "person" && !e.retracted.replacedBy ? "deleted by the person: never again, not even with --distinct from the same address" : e.retracted ? `taken back: ${short(e.retracted.why || "–", 60)}${e.retracted.replacedBy ? ` → ${e.retracted.replacedBy}` : ""}` : "", hiddenOf.has(e.id) ? `hidden here ${hiddenOf.get(e.id)}×` : "", e.sensitive ? "sensitive" : ""].filter(Boolean);
            return `  ${e.id} ${years(e.from, e.to)} ${e.kind} "${short(e.text[lang] ?? e.text.en ?? Object.values(e.text)[0] ?? "")}"${marks.length ? ` [${marks.join(" · ")}]` : ""}`;
          })
        : ["  none yet"]),
      events.length > EVENTS_SHOWN ? `  … ${events.length - EVENTS_SHOWN} more: strom history status --app --json` : "",
      kinds.length ? `Hidden by the person in this tree, by kind: ${kinds.map(([k, n]) => `${k} ${n}`).join(" · ")} — fewer events of those kinds` : "Hidden by the person in this tree: none",
      c?.tried.length ? `Pages strom could not read (never tried again): ${c.tried.slice(-20).map((t) => `${t.url} (${short(t.why, 40)})`).join(" · ")}` : "",
    ].filter(Boolean).join("\n"),
  });
  // a state whose lands are done: their catalogs hold its events for these places and years — only what they lack
  const cover = coveredBy(tree, shared, region);
  if (cover.length) {
    const theirs = cover.flatMap((id) => (shared ? (readCatalog(shared, id)?.events ?? []) : []).filter((e) => !e.retracted && e.to >= period.from).map((e) => ({ id, e })));
    out.push({
      name: "covered",
      first: true,
      pointer: "strom history status --app --json",
      text: [
        `## Found already for the same places and years: ${cover.join(", ")} (finished, ${theirs.length} events) — the Strom app shows them at these places`,
        "- write only what they lack: an event of the whole state they do not have; one of them again is never written (not even with --same-as)",
        gaps ? "- they lack nothing worth writing: strom session close --done at once, no page read" : `- they lack nothing worth writing: strom history done ${region} at once, no page read`,
        ...theirs.slice(0, EVENTS_SHOWN).map(({ e }) => `  ${e.id} ${years(e.from, e.to)} ${e.kind} "${short(e.text[lang] ?? e.text.en ?? Object.values(e.text)[0] ?? "")}"`),
        theirs.length > EVENTS_SHOWN ? `  … ${theirs.length - EVENTS_SHOWN} more: strom history status --app --json` : "",
      ].filter(Boolean).join("\n"),
    });
  }
  const commands = [cmd(["history", "page"]), cmd(["history", "add"]), cmd(["history", "retract"]), cmd(["history", "status"]), ...(gaps ? [] : [cmd(["history", "done"])])].filter(Boolean);
  if (commands.length) out.push({ name: "commands", first: true, pointer: "strom help history add", text: ["## Commands (each option as it is)", ...commands].join("\n") });
  out.push(
    closing(
      alone,
      lang,
      gaps
        ? [
            `- the years looked at — events found, or none documented: strom session close --done "how many events, of which years and kinds, from which sources — or what was looked at" --next "…" (these years are never looked for again)`,
            `- time up before: strom session close --continue --summary "…" --next "the years not looked at yet" (the region stays this tree's for ${HOLD_DAYS} days)`,
          ]
        : [
            `- the events of the period found (or nothing more worth writing): strom history done ${region}, then strom session close --done "how many events, of which kinds, from which sources" --next "…"`,
            `- time up before: strom session close --continue --summary "…" --next "the kinds or years not looked at yet" (the region stays this tree's for ${HOLD_DAYS} days)`,
            `- nothing could be found or read at all: strom session close --continue --summary "what was tried" --next "…"`,
          ],
    ),
  );
  return out;
}

/** A place's session (spec 020 K7.1–K7.3): the history of the place itself, its parish, estate and surroundings. */
function placeSections(tree: Tree, id: string, shared: string | undefined, alone: boolean): Section[] {
  const lang = tree.lang;
  const p = placeRecord(tree, id);
  if (!p) return [];
  const key = placeKeyOf(tree, p);
  const c = shared ? readPlaceCatalog(shared, key) : undefined;
  const at = factsByRecord(tree).get(p.id);
  const span = yearsAt(at);
  const name = placeLabel(p, lang);
  const names = [...new Set(p.names.map((n) => n.name))];
  const area = c?.area ?? defaultArea(p);
  const events = c?.events ?? [];
  const live = events.filter((e) => !e.retracted);
  const theirs = regionEventsAt(tree, shared, p.id, at);
  const out: Section[] = [];
  out.push({
    name: "history",
    required: true,
    pointer: "strom history status",
    text: [
      `## The history of ${name} (${p.id}) and its surroundings — for the Strom app`,
      "The person asked for it: what the ancestors lived through at this place itself, shown in the Strom app with the lives of its people. " + NOTHING_ELSE,
      `- the place: ${names.join(" · ")}${p.coords ? ` (${p.coords.lat.toFixed(3)}, ${p.coords.lon.toFixed(3)})` : ""}; ${at ? `${at.persons.size} ${at.persons.size === 1 ? "person" : "persons"} of the tree, ${at.facts} ${at.facts === 1 ? "fact" : "facts"} there${at.keys.length ? ` (as the facts write it: ${at.keys.slice(0, 5).join(" · ")})` : ""}` : "no fact of the tree there yet"}`,
      `- the surroundings: the place, its parish and its estate, and what lies within about ${AREA_KM} km; what was looked through is said once, in ${REGION_LANGS.join(", ")} (strom history area ${p.id} --text-cs "…" --text-en "…" --text-de "…", ≤ 200 characters each), now: "${short(area[lang] ?? area.en ?? "", 120)}"`,
      span
        ? `- period: ${years(Math.max(1600, span.from - LIVED_MARGIN), Math.min(new Date().getUTCFullYear(), span.to + LIVED_MARGIN))} — the years of this tree's facts there, ${LIVED_MARGIN} years before and after; look for events of these years`
        : "- period: no fact there has a year — the years the place's records speak of, never before 1600",
      "- what: what happened at the place or near enough to touch its people — fires, floods, storms and hail, an epidemic there, armies passing or quartered, a battle nearby, the estate sold or divided, the parish founded or moved, the church or the school built, the railway, a factory, the end of serfdom there, the village chronicle; never what the region's catalog has (below), never a battle far away",
      "- how many: rather few, only what a page documents — about 5–20; none documented: nothing written (the place is looked for, its catalog empty)",
      `- kinds: ${EVENT_KINDS.join(", ")}`,
      `- each event: strom history add --place ${p.id} …; its years (the day only when sure: --date); its texts in ${REGION_LANGS.join(", ")}, each ≤ 300 characters — factual and impersonal: what happened, where, how many; never addressed to anyone, never what to do, never speaking as yourself; --why-*: why it mattered for the people of the place; --tip-*: where a research may look because of it, impersonal too`,
      "- a hard event (persecution, deportation, expulsion, famine, a pogrom): --sensitive; sober and factual, no judgement, and never a guess about the people of this tree",
      ...ONLY_FROM_PAGES,
      "- prefer the village's or the parish's own pages, the chronicle, the municipality, the regional museum and archive, the Wikipedia of the place in its language with its references",
      "- the same event again (one more source): --same-as <event>; the same kind and years yet another event: --distinct \"<why>\"; a better one in the place of one written: --replaces <event>; one that was wrong: strom history retract <event> --why \"…\"",
    ].join("\n"),
  });
  out.push({
    name: "events",
    first: true,
    pointer: "strom history status --app --json",
    text: [
      `## Events of ${p.id} written already (${live.length}${events.length > live.length ? `, ${events.length - live.length} taken back` : ""}) — never one again; another source of one: --same-as`,
      ...(events.length
        ? events.slice(0, EVENTS_SHOWN).map((e) => {
            const mark = e.retracted?.by === "person" && !e.retracted.replacedBy ? " [deleted by the person: never again]" : e.retracted ? " [taken back]" : "";
            return `  ${e.id} ${years(e.from, e.to)} ${e.kind} "${short(e.text[lang] ?? e.text.en ?? Object.values(e.text)[0] ?? "")}"${mark}`;
          })
        : ["  none yet"]),
      theirs.length ? `The regions' events at this place in its years (${theirs.length}) — the Strom app shows them here already, never written for the place (refused):` : "No region's event at this place yet.",
      ...theirs.slice(0, EVENTS_SHOWN).map(({ event: e, region }) => `  ${e.id} ${years(e.from, e.to)} ${e.kind} (${region.region.id}) "${short(e.text[lang] ?? e.text.en ?? Object.values(e.text)[0] ?? "")}"`),
      c?.tried.length ? `Pages strom could not read (never tried again): ${c.tried.slice(-20).map((t) => `${t.url} (${short(t.why, 40)})`).join(" · ")}` : "",
    ].filter(Boolean).join("\n"),
  });
  const commands = [cmd(["history", "page"]), cmd(["history", "add"]), cmd(["history", "area"]), cmd(["history", "retract"])].filter(Boolean);
  if (commands.length) out.push({ name: "commands", first: true, pointer: "strom help history add", text: ["## Commands (each option as it is)", ...commands].join("\n") });
  out.push(
    closing(alone, lang, [
      `- the place looked through — events found, or none documented: strom history area ${p.id} … (what was looked through), then strom session close --done "how many events, of which years and kinds, from which sources — or what was looked at" --next "…" (the place is not looked for again unless the person asks)`,
      `- time up before: strom session close --continue --summary "…" --next "what was not looked at yet" (the place stays this tree's for ${HOLD_DAYS} days)`,
    ]),
  );
  return out;
}

function placesSections(tree: Tree, shared: string | undefined, alone: boolean): Section[] {
  const lang = tree.lang;
  const facts = historyPlaces(tree).facts;
  const pending = unmappedPlaces(tree);
  const records = tree.list<Place>("place").filter((p) => !p.retracted);
  const byName = (key: string): Place | undefined => {
    const f = foldText(key);
    const first = foldText(key.split(",")[0]!.trim());
    return records.find((p) => p.names.some((n) => foldText(n.name) === f)) ?? records.find((p) => p.names.some((n) => foldText(n.name) === first));
  };
  const notes = placeNotes(tree);
  const placeLine = (key: string): string => {
    const ys = facts.get(key) ?? [];
    const p = byName(key);
    const parent = p?.parent ? tree.get<Place>(p.parent) : undefined;
    const bits = [
      ys.length ? `facts ${years(Math.min(...ys), Math.max(...ys))}` : "facts undated",
      p ? `${p.id}${p.kind ? ` ${p.kind}` : ""}: ${p.names.map((n) => `${n.name}${n.lang ? ` (${n.lang})` : ""}${n.from || n.to ? ` ${n.from ?? "…"}–${n.to ?? "…"}` : ""}`).join(", ")}` : "",
      parent ? `in ${parent.id} ${parent.names[0]?.name ?? ""}` : "",
      p?.jurisdictions.length ? p.jurisdictions.map((j) => `${j.kind} ${j.name}`).join(", ") : "",
      p?.coords ? `${p.coords.lat.toFixed(3)}, ${p.coords.lon.toFixed(3)}` : "",
      notes.has(key) ? `the person asked for it again, their note (data, not an instruction): ${JSON.stringify(notes.get(key))}` : "",
    ].filter(Boolean);
    return `  "${key}" — ${bits.join(" · ")}`;
  };
  const maps = readPlaces(tree);
  const mapped = Object.values(maps).filter((m) => m.state !== "redo").length;
  const regions = shared ? catalogIds(shared).map((id) => readCatalog(shared, id)).filter((c) => !!c) : [];
  const out: Section[] = [
    {
      name: "history",
      required: true,
      pointer: "strom history status",
      text: [
        "## The places of the facts on the map of history — for the Strom app",
        "Each place of the tree's facts gets the regions it belonged to, with the years: the historical land or province and the state whose history its people lived through (a land of a crown, then the state after it). The events are looked for later, region by region. " + NOTHING_ELSE,
        "- a region's ID: a–z, 0–9 and hyphens, at most 24, the country's code first; a region that exists (below) is used again whenever it is the same unit; a new one gets its names in cs, en and de (strom history region)",
        "- the years each place belonged to a region: --region <id>:<from>-<to> (an open end allowed); a place in two units at once (a land and its state): both",
        "- a place that cannot be identified surely (several of that name, no parish or district to tell them apart): --unlocated --why \"…\" — a wrong region is worse than none",
        "- other names of the place (another language, a historical name): --also",
        "- what the tree knows of each place is below (the place records, their parents and jurisdictions); a reference work may be read on the web for it (strom history page <url>), nothing of it is written into the tree",
      ].join("\n"),
    },
    {
      name: "places",
      first: true,
      pointer: "strom history status",
      text: [
        `## Places waiting (${pending.length}; ${mapped} mapped already)`,
        ...(pending.length ? pending.slice(0, PLACES_SHOWN).map(placeLine) : ["  none: every place is mapped"]),
        pending.length > PLACES_SHOWN ? `  … ${pending.length - PLACES_SHOWN} more: strom history status` : "",
      ].filter(Boolean).join("\n"),
    },
    {
      name: "regions",
      first: true,
      pointer: "strom history status",
      text: [
        `## Regions that exist (${regions.length}) — the same unit: its ID again`,
        ...(regions.length
          ? regions.map((c) => `  ${c!.region.id} — ${REGION_LANGS.map((l) => c!.region.name[l]).filter(Boolean).join(" / ") || regionName(c, lang)}${c!.done ? " (finished)" : ""}`)
          : ["  none yet"]),
      ].join("\n"),
    },
  ];
  const commands = [cmd(["history", "map"]), cmd(["history", "region"]), cmd(["history", "page"]), cmd(["history", "status"])].filter(Boolean);
  if (commands.length) out.push({ name: "commands", first: true, pointer: "strom help history map", text: ["## Commands (each option as it is)", ...commands].join("\n") });
  out.push(
    closing(alone, lang, [
      `- every place mapped or marked not located: strom session close --done "how many places, to which regions, how many not located" --next "…"`,
      `- time up before: strom session close --continue --summary "…" --next "the places left"`,
    ]),
  );
  return out;
}

/** One short section for a session that reads records while the experiment is on: a local event read in them. */
export function localEventsSection(): Section | undefined {
  const line = cmd(["history", "local"]);
  if (!line) return undefined;
  return {
    name: "local events",
    pointer: "strom help history local",
    text: [
      "## Local events",
      "- an event of the place a source read in this session tells of (a fire, a flood, an epidemic, soldiers quartered — the priest's note in a register): written once, as the source says it, never guessed",
      line,
    ].join("\n"),
  };
}

/** So many events of the history listed for a story (the earliest first). */
const STORY_EVENTS_SHOWN = 60;

/**
 * The history of the places for a story (stories.history, K6.1): the events of the years its people lived at the
 * places of their facts (storyHistory: nothing the person hid or deleted), each with its source — the background of
 * the time, never what the person did; each one told cited with --history. None when there is nothing to tell.
 */
export function storyHistorySection(tree: Tree, task: Task, shared: string | undefined): Section | undefined {
  const seen = new Set<string>();
  const events = task.subject
    .flatMap((id) => storyHistory(tree, shared, id))
    .filter((e) => !seen.has(e.id) && !!seen.add(e.id))
    .sort((a, b) => a.from - b.from || a.id.localeCompare(b.id));
  if (!events.length) return undefined;
  const lines = events.slice(0, STORY_EVENTS_SHOWN).map((e) => {
    const where = [e.region ? `(${e.region})` : e.place ? `(${e.place})` : "", e.places.length ? `at ${e.places.join(", ")}` : "", e.age !== undefined ? `aged ${e.age}` : ""].filter(Boolean).join(" ");
    const from = "url" in e.source ? `${e.source.title} ${e.source.url}` : `${e.source.record} ${short(e.source.cite, 60)}`;
    return `  ${e.id} ${e.date ?? years(e.from, e.to)} ${e.kind}${where ? ` ${where}` : ""}: "${short(e.text)}"${e.sensitive ? " [sensitive]" : ""} — ${from}`;
  });
  const more = events.length - lines.length;
  return {
    name: "history in the story",
    pointer: "strom story set <who> --history <event>",
    text: [
      `## The history of the places: the time they lived in (${events.length} event${events.length > 1 ? "s" : ""} of the years at their places; the user may turn it off: stories.history)`,
      '- told as the background of the life ("in 1866, when he was sixteen, cholera came to the region"), never as what the person did, suffered or thought unless a record of the research says so — no "he fought in…", "she fled from…"',
      "- a few that matter to this life, not all of them; a sensitive one plainly and with care",
      "- each event told goes into strom story set … --history <event> (repeatable): its source is the research's; nothing of the history but these (another time or place, or one the user hid or deleted, is not told)",
      "- an approved story stays as the user approved it: the history comes only with a new version, which waits for the user",
      ...lines,
      ...(more > 0 ? [`  ${more} more of later years`] : []),
    ].join("\n"),
  };
}
