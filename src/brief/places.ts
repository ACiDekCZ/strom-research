// The brief of a session identifying places (spec 034, core/placeid.ts): the batch of the queue this session takes —
// each place as the facts write it, what the tree knows of it — and how: from the cheap steps up (the tree itself, the
// street rules, then well-known references on the web), the three degrees of certainty, the person's hand never moved,
// only the place's name ever sent anywhere. Nothing of the records, the method or the people's queue.

import type { Place, Repository, Task } from "../core/model.ts";
import type { Tree } from "../core/tree.ts";
import { langName } from "../core/lang.ts";
import { match } from "../cli/registry.ts";
import { synopsis } from "./sheet.ts";
import type { Section } from "./brief.ts";
import { factForms, personsHand, PLACES_IDENTIFY_ORIGIN, queueBatches, readPlacesFile, recordIndex, type FactForm, type QueueEntry } from "../core/placeid.ts";
import { historyOn } from "../core/pastevents.ts";
import { othersRecords, type PlaceSigns } from "../core/placeadopt.ts";
import { foldText } from "../core/text.ts";
import type { Settings } from "../core/config.ts";

/** A task of identifying places. */
export function forPlaces(t: Pick<Task, "origin">): boolean {
  return t.origin === PLACES_IDENTIFY_ORIGIN;
}

function cmd(words: string[]): string | undefined {
  const m = match(words);
  return m && m.used === words.length ? `  ${synopsis(m.def)}` : undefined;
}

function span(ys: number[]): string {
  if (!ys.length) return "undated";
  const a = Math.min(...ys);
  const b = Math.max(...ys);
  return a === b ? String(a) : `${a}–${b}`;
}

/** One place of the batch: its form, the facts, the people, the archives of its sources, the record of it. */
function placeLine(tree: Tree, form: string, f: FactForm | undefined, entry: QueueEntry, p: Place | undefined, others: (PlaceSigns & { tree: string })[]): string {
  const areas = f
    ? [...f.areas.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([id]) => {
          const r = tree.get<Repository>(id);
          return r?.type === "repository" ? `${id} ${r.name}` : id;
        })
    : [];
  const persons = f ? [...f.persons].slice(0, 4) : [];
  const bits = [
    f ? `${f.facts} fact${f.facts === 1 ? "" : "s"} ${span(f.years)}` : "",
    persons.length ? `people ${persons.join(" ")}${f!.persons.size > persons.length ? " …" : ""}` : "",
    areas.length ? `sources from ${areas.join(", ")}` : "",
    p ? `record ${p.id}: ${p.names.map((n) => n.name).join(", ")}` : "no record yet",
    p?.parent ? `in ${p.parent}` : "",
    p?.jurisdictions.length ? p.jurisdictions.map((j) => `${j.kind} ${j.name}${j.from || j.to ? ` ${j.from ?? "…"}–${j.to ?? "…"}` : ""}`).join(", ") : "",
    p?.coords ? `on the map ${p.coords.lat.toFixed(4)}, ${p.coords.lon.toFixed(4)}${personsHand(p) ? " (the person's — never moved)" : ""}` : "",
    p?.unlocated ? `not located before: ${p.unlocated}${p.locating?.needs ? ` (would decide it: ${p.locating.needs})` : ""} — something new is known of it now` : "",
    entry.check ? "CHECK the coordinates against the records" : "",
    ...others.map((o) =>
      `another research here (${o.tree}): ${[o.kind, o.parish ? `parish ${o.parish.join(", ")}` : "", o.district ? `district ${o.district.join(", ")}` : "", o.coords ? `${o.coords.lat.toFixed(4)}, ${o.coords.lon.toFixed(4)}` : ""].filter(Boolean).join(" ")} — the same place only where the parish or district agrees`,
    ),
  ].filter(Boolean);
  return `  "${form}" — ${bits.join(" · ")}`;
}

/**
 * The sections of a session on the task of identification, after its header and its task. Undefined for any other
 * task (or an empty queue: the brief of the task alone).
 */
export function placesIdentifySections(tree: Tree, task: Task, alone: boolean, settings: Settings): Section[] | undefined {
  if (!forPlaces(task)) return undefined;
  const file = readPlacesFile(tree);
  const forms = factForms(tree);
  const batches = queueBatches(tree, file, forms);
  const batch = batches[0] ?? [];
  const recordOf = recordIndex(tree);
  const history = historyOn(tree, settings);
  const formOf = (key: string, e: QueueEntry) => forms.get(key)?.form ?? e.form;
  const others = othersRecords(tree, batch.map(([k, e]) => formOf(k, e)), settings);
  const out: Section[] = [
    {
      name: "places",
      required: true,
      pointer: "strom place queue",
      text: [
        `## The places to identify in this session (${batch.length}; the whole queue ${Object.keys(file.queue).length}) — for the map, the history and the houses`,
        "Which place of its name each is (several villages share one name), where it lies, its names and its parish or district. The person asked for them; the facts and the people stay as they are — only the place records and the way the facts write a place are written.",
        ...(batch.length ? batch.map(([key, e]) => placeLine(tree, formOf(key, e), forms.get(key), e, recordOf(formOf(key, e)), others.get(foldText(formOf(key, e))) ?? [])) : ["  none: the queue is empty — close the session"]),
      ].join("\n"),
    },
    {
      name: "method",
      required: true,
      pointer: "strom help place identify",
      text: [
        "## How — from the cheap steps up, the web last",
        "1. free, the tree first: the sources of the facts there (their archive, parish, register — strom show S… or B…, any record by its ID), the other places of the same people and years (strom person card P…), the place records (strom place show L…), the records of other research on this computer (above); a place the tree tells apart already needs nothing else",
        "2. free, the writing: abbreviations and other spellings of one place (strom place rewrite … --to L…); a street or a house number written as a place (\"Lhota, Dlouhá\", \"Horní 12\"): the place is the municipality, the street goes into the house (--house), a house written there is never replaced",
        "3. the web last, for what is still open: gazetteers, the registers of municipalities, historical maps and the Wikipedia in the region's language. Only the place's name with its parish or district goes into a search — never a person's name, a date or anything else of the tree",
        "",
        "",
        "The record of a place:",
        "- its first name is the official name of today in the language of the country it lies in now (a village now in Poland: Polish; the German name is historical) — the names of the facts and the old names go in as --form and --alt name@lang:from-to (an old name: from-to its years; one year: name@lang:1844)",
        "- what is found of a place goes into its record, also where the coordinates are right already: strom place verify L… --ok --why \"…\" --alt … --form … (never only into the history)",
        "- a jurisdiction found wrong (another parish): strom place verify L… --ok --why \"what the records say\" --drop-jurisdiction parish:<name> --jurisdiction parish:<right one>:from-to",
        "- a form of the facts that is a place with a record already (\"Nové Lhoty\" of Lhoty): strom place identify L… --form \"<form>\" — never a second record; two records of one place: strom place merge L… --into L… --reason \"…\"",
        "",
        "Three degrees, never guessed:",
        "- sure (the parish of the records, the district and the years agree; no other place of the name fits): strom place identify \"<form>\" --lat … --lon … --why \"on what\" [--name, --form for each other writing of the facts, --alt for another language or an old name (name@lang:from-to), --jurisdiction kind:name:from-to, --source-title/--source-url of the reference read]",
        "- probable (1–3 places fit): strom place propose \"<form>\" --candidate \"name|lat|lon|why|district|country|title|url\" for each — the person chooses",
        "- not to be decided: strom place unlocated \"<form>\" --why \"…\" --needs \"what would decide it\" — it comes back by itself when that is known; a wrong place is worse than none",
        "- a place on the map the person put there is never moved: the records agree — strom place verify L… --ok --why \"…\"; they do not — strom place propose L… --conflict --candidate …; it cannot be told — strom place verify L… --undecided \"why\"",
        "- one place written several ways in the facts: strom place rewrite \"<form>\" --to L… (a street: --house \"<street>\"; a house written there is kept) when sure; else --propose --why \"…\" — the person says yes",
        ...(history
          ? [
              "- the history of the places is on: each place identified gets its regions too — strom history map \"<form>\" --region <id>:<from>-<to> [--region …] (each region's ID as strom history status lists it; every period of the place covered, none left out)",
            ]
          : []),
        "- this session is on the places only: no searches of records are written here (strom search add), nothing of the people",
      ].join("\n"),
    },
  ];
  const commands = [
    cmd(["place", "identify"]),
    cmd(["place", "propose"]),
    cmd(["place", "unlocated"]),
    cmd(["place", "verify"]),
    cmd(["place", "rewrite"]),
    cmd(["place", "merge"]),
    cmd(["place", "show"]),
    ...(history ? [cmd(["history", "map"])] : []),
  ].filter(Boolean);
  if (commands.length) out.push({ name: "commands", first: true, pointer: "strom help place", text: ["## Commands (each option as it is)", ...commands].join("\n") });
  const more = batches.length > 1;
  out.push({
    name: "closing",
    required: true,
    pointer: "",
    text: [
      "## Finishing",
      `- every place above identified, proposed or not located: strom session close --done "what was found of the places, in a few words" (strom puts the counts before it: identified, verified, asked, not located)${more ? ' --next "the next places of the queue"' : ""}`,
      `- time up before: strom session close --continue --summary "…" --next "the places left"`,
      alone
        ? `- the summary: plain words for the record (the menu, the Strom app), in ${langName(tree.lang)}, never addressed to the user, no advice; after strom session close you are done: a last message of one line at most`
        : "- the user reads the summary (the menu, the Strom app): plain words, never addressed to them",
    ].join("\n"),
  });
  return out;
}
