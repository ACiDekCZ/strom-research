// The brief: everything an agent needs for one task, and nothing more.
//
// In the old workflow the agent read the whole protocol at the start of a
// session and its context was summarised within minutes (median ~11 min).
// The brief has a hard token budget; sections come in priority order and
// what does not fit is cut to a pointer: the command that shows the rest.

import type { Citation, Conflict, Hypothesis, Input, Lesson, Media, Person, Place, RecordSet, Repository, Research, Search, Session, Task } from "../core/model.ts";
import fs from "node:fs";
import path from "node:path";
import { inboxFolders, inputPath } from "../core/media.ts";
import { displayName, familiesAsChild, familiesAsPartner, formatName, label, lifespan, likelyDuplicates, parentsOf, sameFamilyName, surnameForms } from "../core/people.ts";
import { parseYears } from "../core/years.ts";
import { langName } from "../core/lang.ts";
import { dateYears } from "../core/gdate.ts";
import { methodFor } from "../core/assets.ts";
import { recentSessions } from "../core/session.ts";
import { briefClock } from "../core/clock.ts";
import { calibrationLine } from "../core/calibration.ts";
import { taskRecordsets } from "../core/frontier.ts";
import { reviewItems } from "../core/review.ts";
import { readyConnectors } from "../core/connector.ts";
import { runs, shellArg } from "../cli/format.ts";
import { commandSheet } from "./sheet.ts";
import { foldText } from "../core/text.ts";
import { subjectPeople } from "../core/records.ts";
import { hypothesisPeople } from "../core/directions.ts";
import type { Tree } from "../core/tree.ts";
import { imagesIndex } from "../core/mediaindex.ts";

export { DEFAULT_BUDGET } from "../core/config.ts";
import { DEFAULT_BUDGET } from "../core/config.ts";

/**
 * Estimated tokens, on the safe side. A word of plain ASCII (English, IDs, numbers) takes about 2.5 characters a
 * token; a word with any other letter — a diacritic, another script — about one, the whole word (measured on the
 * briefs and outputs of real sessions: a Czech research's brief is 1.7–1.8 characters a token, not 3.5).
 */
export function tokens(text: string): number {
  let other = 0;
  for (const m of text.matchAll(/\S+/gu)) if (/[^\x00-\x7F]/u.test(m[0])) other += m[0].length;
  return Math.ceil((text.length - other) / 2.5 + other);
}

export interface Section {
  name: string;
  text: string;
  /** Shown instead when the section does not fit. */
  pointer: string;
  required?: boolean;
  /** Given its room right after the required ones (still cut when even that does not fit). */
  first?: boolean;
  /** Given what room is left after all the others: a long list with a command for the rest, cut first. */
  last?: boolean;
}

export interface Brief {
  text: string;
  sections: { name: string; tokens: number; cut: boolean }[];
  total: number;
  budget: number;
}

function eventLine(e: Person["events"][number]): string {
  const cites = citesOf(e.citations);
  return `    ${e.id} ${e.kind}${e.label ? ` ${e.label}` : ""}${e.date ? ` ${e.date}` : ""}${e.place ? ` ${e.place}` : ""}${e.house ? `, house ${e.house}` : ""}${e.value ? ` "${e.value}"` : ""} [${e.status}]${cites ? ` ← ${cites}` : ""}`;
}

function citesOf(citations: Citation[] | undefined): string {
  return (citations ?? []).map((c) => `${c.source}${c.locator ? ` ${c.locator}` : ""}`).join(", ");
}

function personBlock(tree: Tree, p: Person, depth: number): string[] {
  const out = [`  ${label(p)} ${p.sex}`];
  // other names, and where any name comes from
  if (p.names.length > 1 || p.names.some((n) => n.citations?.length))
    out.push(`    names: ${p.names.map((n) => `${formatName(n)}${n.kind ? ` (${n.kind})` : ""}${n.citations?.length ? ` ← ${citesOf(n.citations)}` : ""}`).join("; ")}`);
  for (const e of p.events.filter((x) => !x.retracted)) out.push(eventLine(e));
  const parents = parentsOf(tree, p.id);
  const birthFamily = familiesAsChild(tree, p.id)[0];
  out.push(`    parents: ${parents.length ? parents.map(label).join(" & ") : "unknown"}${birthFamily?.citations?.length ? ` (${birthFamily.id} ← ${citesOf(birthFamily.citations)})` : ""}`);
  if (depth > 0)
    for (const f of familiesAsPartner(tree, p.id)) {
      const partner = f.partners.filter((x) => x !== p.id).map((x) => tree.get<Person>(x)).filter(Boolean).map((x) => label(x!));
      const kids = f.children.map((c) => tree.get<Person>(c.person)).filter(Boolean).map((x) => `${displayName(x!)}${lifespan(x!) ? ` ${lifespan(x!)}` : ""}`);
      out.push(`    ${f.id} with ${partner.join(", ") || "?"}${kids.length ? ` · children: ${kids.join(", ")}` : ""}`);
    }
  if (p.story) out.push(`    story: ${p.story.status}${p.story.title ? ` "${p.story.title}"` : ""}, ${p.story.text.split(/\s+/).length} words (strom story show ${p.id})`);
  for (const n of p.notes.slice(-3)) out.push(`    note: ${n.text}`);
  if (p.notes.length > 3) out.push(`    (${p.notes.length - 3} older note${p.notes.length > 4 ? "s" : ""}: strom person show ${p.id})`);
  return out;
}

const VITAL = new Set(["BIRT", "CHR", "BAPM", "DEAT", "BURI", "CREM"]);
const NOTE_SHOWN = 300;

/** Where a person lived and what they did, the years with each: what tells namesakes apart. */
function identifying(p: Person, vitalToo: boolean): { houses: string[]; work: string[]; more: number } {
  const facts = p.events.filter((e) => !e.retracted && !VITAL.has(e.kind));
  const grouped = (list: [string, string | undefined][]) => {
    const by = new Map<string, Set<number>>();
    for (const [what, date] of list) {
      const years = by.get(what) ?? new Set<number>();
      for (const y of dateYears(date ?? "")) years.add(y);
      by.set(what, years);
    }
    // the years as a span: when, not every record of it
    return [...by].map(([what, years]) => {
      const y = [...years].sort((a, b) => a - b);
      return `${what}${y.length ? ` ${y.length > 1 ? `${y[0]}–${y.at(-1)}` : y[0]}` : ""}`;
    });
  };
  // where they lived: a house in a place, or the place of a residence
  const lived = (e: Person["events"][number]) => !!e.house || (e.kind === "RESI" && !!e.place);
  const houses = grouped((vitalToo ? p.events.filter((e) => !e.retracted) : facts).filter(lived).map((e) => [[e.place, e.house].filter(Boolean).join(" "), e.date]));
  const work = grouped(facts.filter((e) => e.kind === "OCCU" && e.value).map((e) => [e.value!, e.date]));
  const more = facts.filter((e) => !lived(e) && !(e.kind === "OCCU" && e.value)).length;
  return { houses, work, more };
}

/** A parent of the task's person: the vital facts (sources by ID), where they lived and what they did, the parents, the last notes cut short. */
function relativeBlock(tree: Tree, p: Person, role: string): string[] {
  const out = [`  ${label(p)} ${p.sex} — ${role}`];
  for (const e of p.events.filter((x) => !x.retracted && VITAL.has(x.kind)))
    out.push(`    ${e.id} ${e.kind}${e.date ? ` ${e.date}` : ""}${e.place ? ` ${e.place}` : ""}${e.house ? `, house ${e.house}` : ""} [${e.status}]${e.citations?.length ? ` ← ${[...new Set(e.citations.map((c) => c.source))].join(", ")}` : ""}`);
  const { houses, work, more } = identifying(p, false);
  if (houses.length || work.length || more)
    out.push(`    ${[houses.length ? `lived: ${houses.join("; ")}` : "", work.length ? `occupation: ${work.join("; ")}` : "", more ? `${more} more fact${more > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · ")}`);
  const parents = parentsOf(tree, p.id);
  out.push(`    parents: ${parents.length ? parents.map(label).join(" & ") : "unknown"}`);
  for (const n of p.notes.slice(-2)) out.push(`    note: ${[...n.text].length > NOTE_SHOWN ? `${[...n.text].slice(0, NOTE_SHOWN).join("")}…` : n.text}`);
  if (p.notes.length > 2) out.push(`    (${p.notes.length - 2} older note${p.notes.length > 3 ? "s" : ""}: strom person show ${p.id})`);
  return out;
}

/** Anyone else concerned, in one line: who they are to the task's people, where they lived, what they did, their parents. */
function relativeLine(tree: Tree, p: Person, role: string, withParents: boolean): string {
  const { houses, work } = identifying(p, true);
  const parents = withParents ? parentsOf(tree, p.id) : [];
  return `  · ${label(p)} ${p.sex} — ${[role, houses.length ? `lived: ${houses.join("; ")}` : "", work.length ? `occupation: ${work.join("; ")}` : "", parents.length ? `parents: ${parents.map((x) => x.id).join(" & ")}` : ""].filter(Boolean).join(" · ")}`;
}

/** A small text file of an input, as strom input show gives it; unreadable: nothing. */
function readSmall(file: string): string | undefined {
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {
    return undefined;
  }
}

/** Words of a text, folded (any script; NFC or NFD alike). */
function foldedWords(text: string): string[] {
  return foldText(text.normalize("NFC")).split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
}

/** The part of a name its forms share ("Lhoty" → lhot, "Dvořák" → dvorak), long enough to mean it, else none. */
function stem(name: string): string | undefined {
  const s = foldText(name.normalize("NFC")).replace(/[aeiouyаеёиоуыэюяієї]+$/u, "");
  return [...s].length >= 4 ? s : undefined;
}

/**
 * Which lessons of the whole project (no record set, archive or place of their own) go with a task: one naming a
 * family or a place of this tree goes with a task of that family or place (its text, its people, their facts, its
 * books); one naming none of them is general and goes with every task. A name told in a lesson's own words
 * ("Dvořákovi", "u Lhoty") is known by its stem; one not recognised keeps the lesson in — never a lesson lost.
 */
function projectLessonFit(tree: Tree, task: Task | undefined, persons: Person[], where: string[]): (l: Lesson) => boolean {
  const known = new Set<string>();
  const add = (n: string | undefined) => {
    if (!n) return;
    const first = n.trim().split(/[\s,]+/u)[0] ?? "";
    for (const f of [first, ...surnameForms(first)]) {
      const s = stem(f);
      if (s) known.add(s);
    }
  };
  for (const p of tree.list<Person>("person")) if (!p.retracted) for (const n of p.names) add(n.surname);
  for (const pl of tree.list<Place>("place")) for (const n of pl.names) add(n.name);
  for (const b of tree.list<RecordSet>("recordset")) for (const n of b.places ?? []) add(n);
  const books = where.map((w) => tree.get<RecordSet>(w)).filter((b): b is RecordSet => !!b && b.type === "recordset");
  const context = new Set(foldedWords([
    task ? [task.what, task.why, task.doneWhen, ...task.where, ...task.notes.map((n) => n.text)].join(" ") : "",
    ...books.flatMap((b) => [b.title, ...(b.places ?? [])]),
    ...persons.flatMap((p) => [...p.names.map((n) => `${n.given} ${n.surname}`), ...p.events.map((e) => e.place ?? "")]),
    ...persons.flatMap((p) => parentsOf(tree, p.id).flatMap((x) => x.names.map((n) => n.surname))),
  ].join(" ")));
  return (l) => {
    // the names it gives: words written with a capital that are a family or a place of this tree
    const names = l.rule.normalize("NFC").split(/[^\p{L}\p{M}\p{N}]+/u).filter((w) => /^\p{Lu}/u.test(w)).map((w) => foldText(w));
    const its = [...known].filter((k) => names.some((w) => w.startsWith(k)));
    return its.length === 0 || its.some((k) => [...context].some((w) => w.startsWith(k)));
  };
}

/** How many images of a record set are registered, and how to look at them. */
function imagesLine(tree: Tree, b: RecordSet, shared: string | undefined): string {
  // each image once: its parts and other copies are the same image
  const nums = imagesIndex(tree).sets.get(b.id)?.images ?? [];
  if (nums.length === 0) {
    const repo = b.repository ? tree.get<Repository>(b.repository) : undefined;
    const c = b.url && repo?.automation !== "forbidden" && repo?.automation !== "manual" ? readyConnectors(tree.env, shared, b.url)[0] : undefined;
    if (c)
      return `    no images here yet — connector ${c.name} fetches the ones you need: strom fetch ${c.name} <book> --images <from-to> --recordset ${b.id} (<book>: its ID on the portal — strom fetch ${c.name} --find "<place>" finds it)`;
    if (b.url && repo?.automation !== "forbidden" && repo?.automation !== "manual")
      return `    no images here yet, and no connector for this archive — build one now (strom connector new <name> --url <portal>, then its DISCOVERY.md; tell the user in a sentence), then strom fetch; the user saves them by hand only where the archive does not allow automation`;
    return `    no images here yet — the user saves them by hand (never scrape an archive): strom task wait <T…> --images ${b.id}:<numbers> --on "<for the user, in their language: the book, its link, which images as its viewer counts them>", then take the next task`;
  }
  // Which ones exist, when there are gaps (a few runs), or just the span.
  const list = runs(nums);
  const which = list.split(", ").length <= 12 ? list : `${nums[0]}–${nums.at(-1)} with gaps (strom media list --recordset ${b.id})`;
  return `    images registered (${nums.length}): ${which} · strom media view ${b.id}:<image>[-<image>] [--half left|right|both] [--grid] [--crop x,y,w,h]`;
}

/** What the user put in the shared inbox, waiting to be registered — by folder (one download each). */
function inboxLines(shared: string | undefined): { files: number; lines: string[] } {
  if (!shared) return { files: 0, lines: [] };
  try {
    const folders = inboxFolders(path.join(shared, "inbox"));
    const name = (f: string) => path.basename(f);
    return {
      files: folders.reduce((n, f) => n + f.files.length, 0),
      lines: folders.slice(0, 8).map(({ folder, files }) => {
        const shown = files.length > 3 ? `${name(files[0]!)} … ${name(files.at(-1)!)}` : files.map(name).join(", ");
        // a folder strom made for a waiting task names its record set
        const mine = folder && /^[Bb]\d+(?=\s|$)/.test(folder) ? `  → strom media add --inbox ${shellArg(folder)}` : "";
        return folder ? `  ${folder}/ (${files.length} file${files.length > 1 ? "s" : ""}): ${shown}${mine}` : `  ${shown}`;
      }),
    };
  } catch {
    return { files: 0, lines: [] };
  }
}

/** The archives already known, so registering a download needs no lookup. */
function repoHint(tree: Tree): string {
  const repos = tree.list<Repository>("repository");
  if (!repos.length) return 'the archive first: strom repo add "<archive>" --country <CC> --url <its website>';
  const shown = repos.slice(0, 4).map((r) => `${r.id} ${r.name}`).join(" · ");
  return `archives: ${shown}${repos.length > 4 ? " …" : ""} (another: strom repo add "<archive>" --url …)`;
}

export function buildBrief(tree: Tree, opts: { task?: Task; session?: Session; budget?: number; shared?: string | undefined; deadline?: number | undefined }): Brief {
  const budget = opts.budget ?? DEFAULT_BUDGET;
  const task = opts.task;
  const research = (task?.research ? tree.get<Research>(task.research) : undefined) ?? tree.list<Research>("research").find((r) => r.state === "active");
  const lang = tree.lang;
  const sections: Section[] = [];
  const focus = research ? tree.get<Person>(research.focus) : undefined;

  // 1. who, where, rules — and what the research is for
  sections.push({
    name: "header",
    required: true,
    pointer: "",
    text: [
      `# Strom research session${opts.session ? ` ${opts.session.id}` : ""}`,
      `Tree "${tree.config.name}"${research ? ` · research ${research.id} "${research.name}" (${research.direction} of ${focus ? label(focus) : research.focus})` : ""}.`,
      research?.question ? `Research question: ${research.question}` : "",
      ...(research?.notes ?? []).slice(-3).map((n) => `From the user: ${n.text}`),
      `Research language: ${langName(lang)} — talk to the user and write notes, tasks and summaries in ${langName(lang)}; transcripts stay in the original language.`,
      "Work ONLY through `strom` commands; never edit files in data/ (it is detected and blocks all writing). Record findings as you go.",
      opts.deadline !== undefined ? briefClock(opts.deadline) : "",
    ].filter(Boolean).join("\n"),
  });

  // 2. the task
  if (task) {
    const where = task.where.map((w) => {
      const b = /^B\d{4,}$/.test(w) ? tree.get<RecordSet>(w) : undefined;
      return b ? `${b.id} ${b.title}` : w;
    });
    sections.push({
      name: "task",
      required: true,
      pointer: `strom task show ${task.id}`,
      text: [
        `## Task ${task.id} (${task.level}, priority ${task.priority})`,
        `what:  ${task.what}`,
        `where: ${where.join("; ")}`,
        `why:   ${task.why}`,
        `done:  ${task.doneWhen}`,
        task.subject.length ? `about: ${task.subject.join(" ")}` : "",
        ...task.notes.slice(-3).map((n) => `note:  ${n.text}`),
        task.notes.length > 3 ? `(notes: the last 3 of ${task.notes.length} — all: strom task show ${task.id})` : "",
      ].filter(Boolean).join("\n"),
    });

  // 2. a review: what each item of the task is, as the tree has it
  if (task.origin.startsWith("review:") && task.where.length)
    sections.push({ name: "review", required: true, pointer: `strom task show ${task.id}`, text: ["## To review", ...reviewItems(tree, task)].join("\n") });

  // 2a. an imported tree: who in it is probably already in the tree
  const treeInputs = [...new Set([...(task?.subject ?? []), ...(task?.where ?? [])])]
    .map((id) => (/^I\d{4,}$/.test(id) ? tree.get<Input>(id) : undefined))
    .filter((i): i is Input => !!i && i.type === "input" && i.kind === "tree" && !!i.sha);
  for (const input of treeInputs) {
    const system = `gedcom:${input.sha!.slice(0, 12)}`;
    const ids = tree.list<Person>("person").filter((p) => !p.retracted && p.refs?.some((r) => r.system === system)).map((p) => p.id);
    const dupes = likelyDuplicates(tree, ids);
    if (dupes.length)
      sections.push({
        name: "duplicates",
        pointer: "strom person list",
        text: [
          `## Probably already in the tree (${input.id}) — look, then merge into the researched person`,
          ...dupes.map((d) => `  ${label(d.person)} ≈ ${label(d.same)} → strom person merge ${d.same.id} ${d.person.id} --reason "…"`),
        ].join("\n"),
      });
  }

  // 2b. the material of an intake task, so it needs no extra command
  const inputs = [...new Set([...(task?.subject ?? []), ...(task?.where ?? [])])]
    .map((id) => (/^I\d{4,}$/.test(id) ? tree.get<Input>(id) : undefined))
    .filter((i): i is Input => !!i && i.type === "input");
  if (inputs.length)
    sections.push({
      name: "input",
      pointer: `strom input show ${inputs[0]!.id}`,
      text: [
        "## The material",
        ...inputs.map((i) => {
          const file = inputPath(tree, i);
          // all that strom input show says of it, so it needs no extra command (K6)
          const small = !i.text && i.kind === "text" && file && (i.size ?? 0) < 20_000 && /\.(txt|md|csv)$/i.test(file) ? readSmall(file) : undefined;
          return [
            `${i.id} ${i.name} [${i.kind} · ${i.state}]${i.from ? ` from ${i.from}` : ""}${i.mime ? ` · ${i.mime}${i.size !== undefined ? ` ${Math.round(i.size / 1024)} kB` : ""}` : ""}`,
            file ? `file: ${file}${i.kind === "document" || i.kind === "photo" ? " — open it and read it yourself" : ""}` : "",
            i.batch ? `batch: ${i.batch}${i.path ? ` · ${i.path}` : ""}` : "",
            i.persons?.length ? `of: ${i.persons.join(", ")}` : "",
            i.sorted ? `sorted: ${i.sorted.as}${i.sorted.source ? ` → ${i.sorted.source}` : ""}${i.sorted.reason ? ` (${i.sorted.reason})` : ""}` : "",
            i.imported ? `imported: ${i.imported.persons} persons, ${i.imported.families} families as leads, cited as ${i.source}` : "",
            ...i.notes.map((n) => `note: ${n.text}`),
            i.text ? `text:\n${i.text}` : small ? `text:\n${small}` : "",
          ].filter(Boolean).join("\n");
        }),
      ].join("\n"),
    });
  } else
    sections.push({
      name: "task",
      required: true,
      pointer: "strom task next",
      text: "## No task\nThe queue is empty: look at the research (`strom research show`, `strom frontier`) and add tasks.",
    });

  // 3. premise: what was already searched there, and lessons for those places
  const located = task ? taskRecordsets(tree, task) : { sets: [], guessed: false };
  const where = new Set([...(task?.where ?? []), ...located.sets.map((b) => b.id)]);
  // A task about a conflict or a hypothesis is about its people too.
  const subjects = new Set([...(task?.subject ?? []), ...subjectPeople(tree, task?.subject ?? [])]);
  const persons = [...subjects].map((id) => tree.get<Person>(id)).filter((p): p is Person => !!p && p.type === "person");
  const theirs = persons.flatMap((p) => p.names.map((n) => n.surname).filter(Boolean));
  const surnames = new Set(theirs.map((n) => foldText(n)));
  const repos = new Set([...where].map((w) => tree.get<RecordSet>(w)?.repository).filter(Boolean) as string[]);
  // a lesson on a place (L…) goes with the books of that place — or of the parish it belonged to
  const bookPlaces = new Set([...where].flatMap((w) => tree.get<RecordSet>(w)?.places ?? []).map((x) => foldText(x)));
  // Where and when the task is: its books' places and years, its people's places and years (±30) — a search of their
  // surname in other places and other times is only counted (K11).
  const placeKey = (x: string) => foldText(x.split(",")[0]!.trim());
  const taskPlaces = new Set([...bookPlaces].map(placeKey));
  for (const p of persons) for (const e of p.events) if (!e.retracted && e.place) taskPlaces.add(placeKey(e.place));
  const taskYears = [
    ...[...where].flatMap((w) => { const y = parseYears(tree.get<RecordSet>(w)?.years); return y ? [y.from, y.to] : []; }),
    ...persons.flatMap((p) => p.events.filter((e) => !e.retracted).flatMap((e) => dateYears(e.date ?? ""))),
  ];
  const span = taskYears.length ? { from: Math.min(...taskYears) - 30, to: Math.max(...taskYears) + 30 } : undefined;
  const nearby = (s: Search): boolean => {
    const books = s.recordsets.map((b) => tree.get<RecordSet>(b)).filter((b): b is RecordSet => !!b);
    const spans = [s.scope.years, ...(s.scope.years ? [] : books.map((b) => b.years))].map((y) => parseYears(y)).filter((y) => !!y);
    const places = [...(s.scope.places ?? []), ...books.flatMap((b) => b.places)].map(placeKey);
    if (places.some((x) => taskPlaces.has(x))) return true;
    if (span && spans.length) return spans.some((y) => y.from <= span.to && span.from <= y.to);
    // nothing to tell it by: kept
    return !places.length || (!span && !taskPlaces.size);
  };
  const named = (s: Search) => (s.scope.surnames ?? []).some((x) => theirs.some((y) => sameFamilyName(x, y)));
  const premise = tree.list<Search>("search").filter((s) => s.recordsets.some((b) => where.has(b)) || (s.task && s.task === task?.id) || named(s));
  const searches = premise.filter((s) => s.recordsets.some((b) => where.has(b)) || (s.task && s.task === task?.id) || nearby(s));
  const elsewhere = premise.filter((s) => !searches.includes(s));
  const elsewhereNames = [...new Set(elsewhere.flatMap((s) => theirs.filter((y) => (s.scope.surnames ?? []).some((x) => sameFamilyName(x, y)))))];
  const ofPlace = (id: string) => {
    const pl = tree.get<Place>(id);
    return pl?.type === "place" && [...pl.names.map((n) => n.name), ...pl.jurisdictions.map((j) => j.name)].some((n) => [...bookPlaces].some((b) => b === foldText(n) || b.startsWith(`${foldText(n)},`)));
  };
  const all = tree.list<Lesson>("lesson").filter((l) => !l.retracted);
  // a lesson of the whole project goes with the task whose families or places it names — or names none of the tree's
  const project = all.filter((l) => l.scope === "project" && !l.target);
  const fits = project.length ? projectLessonFit(tree, task, persons, [...where]) : () => true;
  const lessons = all.filter((l) => (l.target && (where.has(l.target) || repos.has(l.target) || ofPlace(l.target))) || (l.scope === "project" && (l.target || fits(l))));
  const otherProject = project.filter((l) => !lessons.includes(l)).length;
  const method = all.filter((l) => l.scope === "method").length;
  sections.push({
    name: "premise",
    // shown before the people, but given its room after them, the last sessions and the open questions: a long
    // list of searches never pushes out whom the task is about (P3)
    last: true,
    pointer: `strom searched ${[...where].find((w) => w.startsWith("B")) ?? [...surnames][0] ?? "<where>"}${lessons.length ? " · lessons: strom lesson list" : ""}`,
    text: [
      "## Already known (check the premise before searching)",
      searches.length
        ? searches.map((s) => `  ${s.id} [${s.result}] ${s.question}${s.scope.years ? ` · ${s.scope.years}` : ""}${s.scope.pages ? ` · pages ${s.scope.pages}` : ""} · ${s.recordsets.join(" ")}${s.by !== "main" ? ` (by ${s.by})` : ""}`).join("\n")
        : "  nothing searched yet for this task's record sets and surnames",
      ...(elsewhere.length ? [`  +${elsewhere.length} search${elsewhere.length > 1 ? "es" : ""} of ${elsewhereNames.join(", ")} in other places and years: ${elsewhereNames.map((n) => `strom searched ${shellArg(n)}`).join(" · ")}`] : []),
      ...(lessons.length ? ["lessons:", ...lessons.map((l) => `  ${l.id}${l.target ? ` (${l.target})` : ""}: ${l.rule}`)] : []),
      ...(otherProject ? [`lessons about other families and places: ${otherProject} — strom lesson list --scope project`] : []),
      ...(method ? [`method lessons of this research: ${method} — strom lesson list --scope method`] : []),
    ].join("\n"),
  });

  // 4. handover from the previous sessions
  const recent = recentSessions(tree, research?.id);
  if (recent.length)
    sections.push({
      name: "handover",
      pointer: "strom session list",
      text: ["## Last sessions", ...recent.map((s) => `  ${s.id} ${s.state}${s.task ? ` on ${s.task}` : ""}: ${s.summary ?? "(no summary)"}${s.next ? `\n    next: ${s.next}` : ""}`)].join("\n"),
    });

  // 5. the people concerned: whom the task is about in full, their parents with what identifies them (facts, houses,
  // occupations, parents), grandparents and brothers and sisters one line each — the rest is a command away
  const people = new Map<string, { how: "full" | "parent" | "line"; role: string }>();
  const personSubjects = [...subjects].filter((id) => tree.get(id)?.type === "person");
  // no person named: the research's focus, to know whose tree it is
  const about = personSubjects.length ? personSubjects : research ? [research.focus] : [];
  for (const id of about) people.set(id, { how: "full", role: "" });
  for (const id of about) {
    for (const p of parentsOf(tree, id)) {
      if (!people.has(p.id)) people.set(p.id, { how: personSubjects.length ? "parent" : "line", role: `${p.sex === "F" ? "mother" : p.sex === "M" ? "father" : "parent"} of ${id}` });
      for (const gp of parentsOf(tree, p.id)) if (!people.has(gp.id)) people.set(gp.id, { how: "line", role: `${gp.sex === "F" ? "mother" : gp.sex === "M" ? "father" : "parent"} of ${p.id}` });
    }
    for (const f of familiesAsChild(tree, id)) for (const s of f.children) if (!people.has(s.person) && s.person !== id) people.set(s.person, { how: "line", role: `sibling of ${id}` });
  }
  if (people.size) {
    const blocks = [...people.entries()].flatMap(([id, { how, role }]) => {
      const p = tree.get<Person>(id);
      if (!p) return [];
      if (how === "full") return [personBlock(tree, p, 1).join("\n")];
      if (how === "parent") return [relativeBlock(tree, p, role).join("\n")];
      return [relativeLine(tree, p, role, !role.startsWith("sibling"))];
    });
    const short = [...people.values()].some((x) => x.how !== "full");
    sections.push({
      name: "people",
      pointer: `strom person show ${[...people.keys()][0]}`,
      text: [
        "## People concerned",
        ...blocks,
        ...(short ? ["  (others in short — all facts, sources and notes: strom person show P… · their life with its records: strom person card P…)"] : []),
      ].join("\n"),
    });
  }

  // 6. open conflicts and hypotheses about them
  const ids = new Set(people.keys());
  // the task's own conflicts and hypotheses come first, whatever their state
  const own = (id: string) => subjects.has(id);
  const conflicts = tree.list<Conflict>("conflict").filter((c) => own(c.id) || (c.state === "open" && c.subject.some((s) => ids.has(s))));
  const hyps = tree.list<Hypothesis>("hypothesis").filter((h) => own(h.id) || (h.state === "open" && hypothesisPeople(tree, h).some((s) => ids.has(s))));
  const first = <T extends { id: string }>(list: T[]) => [...list.filter((x) => own(x.id)), ...list.filter((x) => !own(x.id))];
  const mark = (id: string, state: string) => `${own(id) ? "→ " : "  "}${id}${state === "open" ? "" : ` [${state}]`}`;
  if (conflicts.length || hyps.length)
    sections.push({
      name: "open questions",
      pointer: "strom conflict list · strom hypothesis list",
      text: [
        "## Open conflicts and hypotheses" + (conflicts.some((c) => own(c.id)) || hyps.some((h) => own(h.id)) ? " (→ this task is about it)" : ""),
        ...first(conflicts).map((c) => `${mark(c.id, c.state)} ${c.title}: ${c.claims.map((x) => `${x.source ? `${x.source} ` : ""}${x.value}`).join(" | ")}${c.resolution ? ` — resolved: ${c.resolution}` : ""}`),
        ...first(hyps).map((h) => `${mark(h.id, h.state)} ${h.question}: ${h.variants.map((v) => `${v.label}) ${v.claim}`).join("; ")}${h.decision ? ` — ${h.state}: ${h.decision}` : ""}`),
      ].join("\n"),
    });

  // 7. the record sets to work in
  const sets = located.sets;
  if (sets.length)
    sections.push({
      name: "record sets",
      // the books to work in, their images and calibration: kept before the long lists when the brief is full
      first: true,
      pointer: `strom recordset show ${sets[0]!.id}`,
      text: [
        located.guessed
          ? `## Record sets (the task names none; these cover it — point it at the right one: strom task edit ${task!.id} --where ${sets[0]!.id})`
          : "## Record sets",
        ...sets.map((b) => {
          const repo = b.repository ? tree.get<Repository>(b.repository) : undefined;
          return [
            `  ${b.id} ${b.title}`,
            `    ${[b.kinds.join(", "), b.places.join(", "), b.years].filter(Boolean).join(" · ")} · access ${b.access}${b.url ? ` · ${b.url}` : ""}`,
            repo ? `    ${repo.name} · automated download: ${repo.automation}${repo.terms ? ` · terms: ${repo.terms}` : ""}` : "",
            b.layout ? `    layout: ${b.layout}` : "",
            calibrationLine(b) ? `    ${calibrationLine(b)}` : "",
            imagesLine(tree, b, opts.shared),
          ].filter(Boolean).join("\n");
        }),
      ].join("\n"),
    });

  // 7b. what the user put in the shared inbox — scans or documents nobody registered yet
  const inbox = inboxLines(opts.shared);
  if (inbox.files)
    sections.push({
      name: "inbox",
      pointer: "strom media add --inbox <folder> --recordset B…",
      text: [
        `## Waiting in the inbox (${inbox.files} file${inbox.files > 1 ? "s" : ""} from the user)`,
        ...inbox.lines,
        "  one folder = one download = one record set. Register the book, then its scans:",
        `  ${repoHint(tree)}`,
        '  strom recordset add "<title>" --repo R… --call-number <sig> --kinds baptism --places <places> --years <from-to>',
        '  strom media add --inbox "<folder>" --recordset B…   · a document (certificate, letter): strom intake <file>',
      ].join("\n"),
    });

  // 8. method for this kind of task
  // (budgeted first, with the record sets and the commands: when the brief is long, the lists are cut before how to work)
  sections.push({ name: "method", first: true, pointer: "strom guide", text: methodFor(task?.level) });

  // 8b. the commands this kind of task uses, with every option and limit (K2): asking for them costs a turn each
  const sheet = commandSheet(task?.level);
  if (sheet) sections.push({ name: "commands", first: true, pointer: "strom help <command>", text: sheet });

  // 9. how to finish
  sections.push({
    name: "closing",
    required: true,
    pointer: "",
    text: [
      "## Finishing",
      "- new questions → strom task add … (what, where, why, done-when)",
      task
        ? '- done: strom session close --done "what was proven, what was searched in vain" --next "the next cheapest step" (the task and the session in one call; a complete negative search is a result)'
        : '- then: strom session close --summary "what was proven, what was searched in vain" --next "the next cheapest step"',
      task ? `- put aside: strom task park|wait ${task.id} …, then strom session close --summary "…" --next "…"` : "",
      `- if the task is not finished: strom session close --continue --summary "…" --next "exactly where you stopped"`,
      "- a command you need: strom help <command> (short, with examples) — the full guide: strom guide",
    ].filter(Boolean).join("\n"),
  });

  // Assemble within the budget: required sections always, then the first ones whole when they fit, then the others in
  // order, the last ones after them; each written where it stands. Everything written counts: the blank line between
  // sections, the pointer of a section cut.
  const SEP = tokens("\n\n");
  let used = sections.filter((s) => s.required).reduce((n, s) => n + tokens(s.text) + SEP, 0);
  const shown = new Map<Section, { text: string; cut: boolean }>();
  for (const s of sections.filter((x) => x.first && !x.required))
    if (used + tokens(s.text) + SEP <= budget) {
      used += tokens(s.text) + SEP;
      shown.set(s, { text: s.text, cut: false });
    }
  const fit = (s: Section) => {
    const t = tokens(s.text);
    if (!s.first && used + t + SEP <= budget) {
      used += t + SEP;
      shown.set(s, { text: s.text, cut: false });
      return;
    }
    // Its heading always (the agent knows what it was not given), as many whole lines as fit, then the pointer.
    const [head = "", ...rest] = s.text.split("\n");
    const pointer = `  … cut to fit the brief — see: ${s.pointer}`;
    const kept: string[] = [head];
    used += tokens(head) + tokens(pointer) + SEP;
    for (const l of rest) {
      if (used + tokens(l) > budget) break;
      kept.push(l);
      used += tokens(l);
    }
    shown.set(s, { text: [...kept, pointer].join("\n"), cut: true });
  };
  // the others in order, a first one that did not fit whole cut after them, the last ones after all
  const pending = sections.filter((s) => !s.required && !shown.has(s));
  for (const s of [...pending.filter((x) => !x.first && !x.last), ...pending.filter((x) => x.first), ...pending.filter((x) => x.last && !x.first)]) fit(s);
  const report: Brief["sections"] = [];
  const parts: string[] = [];
  for (const s of sections) {
    const r = s.required ? { text: s.text, cut: false } : shown.get(s)!;
    parts.push(r.text);
    report.push({ name: s.name, tokens: tokens(r.text), cut: r.cut });
  }
  const text = parts.join("\n\n") + "\n";
  return { text, sections: report, total: tokens(text), budget };
}

