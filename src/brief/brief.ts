// The brief: everything an agent needs for one task, and nothing more.
//
// In the old workflow the agent read the whole protocol at the start of a
// session and its context was summarised within minutes (median ~11 min).
// The brief has a hard token budget; sections come in priority order and
// what does not fit is cut to a pointer: the command that shows the rest.

import type { Citation, Conflict, Hypothesis, Input, Lesson, Media, Person, RecordSet, Repository, Research, Search, Session, Task } from "../core/model.ts";
import path from "node:path";
import { inboxFolders, inputPath } from "../core/media.ts";
import { displayName, familiesAsChild, familiesAsPartner, formatName, label, lifespan, likelyDuplicates, parentsOf } from "../core/people.ts";
import { langName } from "../core/lang.ts";
import { methodFor } from "../core/assets.ts";
import { recentSessions } from "../core/session.ts";
import { briefClock } from "../core/clock.ts";
import { calibrationLine } from "../core/calibration.ts";
import { taskRecordsets } from "../core/frontier.ts";
import { reviewItems } from "../core/review.ts";
import { readyConnectors } from "../core/connector.ts";
import { runs, shellArg } from "../cli/format.ts";
import { foldText } from "../core/text.ts";
import { subjectPeople } from "../core/records.ts";
import type { Tree } from "../core/tree.ts";

export { DEFAULT_BUDGET } from "../core/config.ts";
import { DEFAULT_BUDGET } from "../core/config.ts";

/** Rough token estimate: good enough for a soft budget. */
export function tokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

export interface Section {
  name: string;
  text: string;
  /** Shown instead when the section does not fit. */
  pointer: string;
  required?: boolean;
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
  return out;
}

/** How many images of a record set are registered, and how to look at them. */
function imagesLine(tree: Tree, b: RecordSet, shared: string | undefined): string {
  // each image once: its parts and other copies are the same image
  const nums = [...new Set(tree
    .list<Media>("media")
    .filter((m) => m.recordset === b.id && m.image !== undefined)
    .map((m) => m.image!))]
    .sort((x, y) => x - y);
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
  return `    images registered (${nums.length}): ${which} · strom media view ${b.id}:<image> [--half left|right] [--grid] [--crop x,y,w,h]`;
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
          return [
            `${i.id} ${i.name} [${i.kind} · ${i.state}]${i.from ? ` from ${i.from}` : ""}`,
            file ? `file: ${file}${i.kind === "document" || i.kind === "photo" ? " — open it and read it yourself" : ""}` : "",
            i.imported ? `imported: ${i.imported.persons} persons, ${i.imported.families} families as leads, cited as ${i.source}` : "",
            i.text ? `text:\n${i.text}` : "",
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
  const surnames = new Set(
    [...subjects].map((id) => tree.get<Person>(id)).filter((p): p is Person => !!p && p.type === "person").flatMap((p) => p.names.map((n) => foldText(n.surname)).filter(Boolean)),
  );
  const searches = tree
    .list<Search>("search")
    .filter((s) => s.recordsets.some((b) => where.has(b)) || (s.task && s.task === task?.id) || (s.scope.surnames ?? []).some((x) => surnames.has(foldText(x))));
  const repos = new Set([...where].map((w) => tree.get<RecordSet>(w)?.repository).filter(Boolean) as string[]);
  const lessons = tree.list<Lesson>("lesson").filter((l) => (l.target && (where.has(l.target) || repos.has(l.target))) || l.scope === "project");
  sections.push({
    name: "premise",
    pointer: `strom searched ${[...where].find((w) => w.startsWith("B")) ?? [...surnames][0] ?? "<where>"}`,
    text: [
      "## Already known (check the premise before searching)",
      searches.length
        ? searches.map((s) => `  ${s.id} [${s.result}] ${s.question}${s.scope.years ? ` · ${s.scope.years}` : ""}${s.scope.pages ? ` · pages ${s.scope.pages}` : ""} · ${s.recordsets.join(" ")}${s.by !== "main" ? ` (by ${s.by})` : ""}`).join("\n")
        : "  nothing searched yet for this task's record sets and surnames",
      ...(lessons.length ? ["lessons:", ...lessons.map((l) => `  ${l.id}${l.target ? ` (${l.target})` : ""}: ${l.rule}`)] : []),
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

  // 5. the people concerned
  const people = new Map<string, number>();
  const personSubjects = [...subjects].filter((id) => tree.get(id)?.type === "person");
  for (const id of personSubjects.length ? personSubjects : research ? [research.focus] : []) {
    people.set(id, 1);
    for (const p of parentsOf(tree, id)) {
      people.set(p.id, Math.max(people.get(p.id) ?? 0, 0));
      for (const gp of parentsOf(tree, p.id)) if (!people.has(gp.id)) people.set(gp.id, 0);
    }
    for (const f of familiesAsChild(tree, id)) for (const s of f.children) if (!people.has(s.person) && s.person !== id) people.set(s.person, 0);
  }
  if (people.size) {
    const blocks = [...people.entries()].map(([id, depth]) => {
      const p = tree.get<Person>(id);
      return p ? personBlock(tree, p, depth).join("\n") : "";
    });
    sections.push({ name: "people", pointer: `strom person show ${[...people.keys()][0]}`, text: ["## People concerned", ...blocks].join("\n") });
  }

  // 6. open conflicts and hypotheses about them
  const ids = new Set(people.keys());
  // the task's own conflicts and hypotheses come first, whatever their state
  const own = (id: string) => subjects.has(id);
  const conflicts = tree.list<Conflict>("conflict").filter((c) => own(c.id) || (c.state === "open" && c.subject.some((s) => ids.has(s))));
  const hyps = tree.list<Hypothesis>("hypothesis").filter((h) => own(h.id) || (h.state === "open" && h.subject.some((s) => ids.has(s))));
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
  sections.push({ name: "method", pointer: "strom guide", text: methodFor(task?.level) });

  // 9. how to finish
  sections.push({
    name: "closing",
    required: true,
    pointer: "",
    text: [
      "## Finishing",
      task ? `- close the task: strom task done ${task.id} --result "…" (a complete negative search is a result) — or task park / task wait` : "",
      "- new questions → strom task add … (what, where, why, done-when)",
      '- then: strom session close --summary "what was proven, what was searched in vain" --next "the next cheapest step"',
      `- if the task is not finished: strom session close --continue --summary "…" --next "exactly where you stopped"`,
      "- a command you need: strom help <command> (short, with examples) — the full guide: strom guide",
    ].filter(Boolean).join("\n"),
  });

  // Assemble within the budget: required sections always, others in order.
  let used = sections.filter((s) => s.required).reduce((n, s) => n + tokens(s.text), 0);
  const report: Brief["sections"] = [];
  const parts: string[] = [];
  for (const s of sections) {
    const t = tokens(s.text);
    if (s.required || used + t <= budget) {
      if (!s.required) used += t;
      parts.push(s.text);
      report.push({ name: s.name, tokens: t, cut: false });
      continue;
    }
    // Keep as many whole lines as fit, then the pointer.
    const lines = s.text.split("\n");
    const kept: string[] = [];
    for (const l of lines) {
      if (used + tokens(l) + 20 > budget) break;
      kept.push(l);
      used += tokens(l);
    }
    parts.push([...kept, `  … cut to fit the brief — see: ${s.pointer}`].join("\n"));
    report.push({ name: s.name, tokens: tokens(kept.join("\n")), cut: true });
  }
  const text = parts.join("\n\n") + "\n";
  return { text, sections: report, total: tokens(text), budget };
}

