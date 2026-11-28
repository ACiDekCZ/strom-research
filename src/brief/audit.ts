// The brief of a task of the tree check (origin health:C…, spec 091): its own sections — the method of the check
// (assets/method/audit.md: the rules of K1.3, the catalog A–L), the checks asked and the scope, the people of the scope
// (only what changed, with --changed), the built-in part's steps to order, the findings so far and those the person
// dismissed — nothing of the research's method, the records' queue or the people's sections.

import type { Section } from "./brief.ts";
import { readAsset } from "../core/assets.ts";
import { langName } from "../core/lang.ts";
import type { Person, Task } from "../core/model.ts";
import type { Tree } from "../core/tree.ts";
import { displayName } from "../core/people.ts";
import { AUDIT_MAX, dismissedIds, readReport, reportOfTask, scopeText, type HealthReport } from "../core/audit.ts";
import { changedSince, scopePeople, type HealthBuiltin } from "../core/health.ts";
import { phrase } from "../core/phrases.ts";

/** At most so many people named (a larger scope: the agent goes line by line through strom). */
const PEOPLE_NAMED = 200;

export function auditSections(tree: Tree, task: Task, alone: boolean): Section[] | undefined {
  const id = reportOfTask(task);
  if (!id) return undefined;
  const r = readReport(tree, id);
  if (!r) return undefined;
  const lang = tree.lang;
  const method = readAsset("method", "audit.md") ?? "";
  const out: Section[] = [
    { name: "method", first: true, pointer: "strom guide", text: method },
    { name: "check", required: true, pointer: `strom health show ${r.id}`, text: checkText(tree, r) },
  ];
  const people = peopleText(tree, r);
  if (people) out.push({ name: "scope", pointer: `strom health show ${r.id}`, text: people });
  const steps = stepsText(r);
  if (steps) out.push({ name: "steps", pointer: "strom health --json", text: steps });
  const dismissed = dismissedIds(tree);
  if (dismissed.length)
    out.push({
      name: "dismissed",
      pointer: "strom audit list --state dismissed",
      text: ["## Dismissed by the user — never reported again", ...dismissed.slice(-100).map((d) => `- ${d.id}${d.type ? ` (${d.type}${d.records?.length ? ` ${d.records.join(" ")}` : ""})` : ""}`), dismissed.length > 100 ? `(the last 100 of ${dismissed.length}: strom audit list --state dismissed)` : ""].filter(Boolean).join("\n"),
    });
  out.push({
    name: "closing",
    required: true,
    pointer: "",
    text: [
      "## Finishing",
      "- each check asked: strom audit checked <type> (also when nothing was found)",
      `- strom audit summary "…" and the steps in order (strom audit order <kind>[:<subject>] --why "…"), in ${langName(lang)}`,
      `- then strom session close --done "…" --next "…" (the task ${task.id} done with it)`,
      alone
        ? `- the summary: plain words for the record (the menu, the Strom app), in ${langName(lang)}, never addressed to the user; after strom session close you are done: a last message of one line at most`
        : "- the user reads the summary and the findings (the menu, the Strom app): plain words, never addressed to them",
    ].join("\n"),
  });
  return out;
}

function checkText(tree: Tree, r: HealthReport): string {
  const lang = tree.lang;
  const n = r.findings?.length ?? 0;
  return [
    `## The tree check ${r.id}`,
    `- checks asked: ${r.ai.map((t) => `${t} (${phrase("en", `audit.type.${t}`)})`).join(", ")}${r.checked?.length ? ` — gone through: ${r.checked.join(", ")}` : ""}`,
    `- scope: ${scopeText(r.scope)}${r.changed ? (r.since ? ` — only what changed since ${r.since.slice(0, 7)}` : " — no check of it before: all of it") : ""}`,
    `- findings so far: ${n} of at most ${AUDIT_MAX}${n ? ` (${(r.findings ?? []).map((f) => f.id).join(" ")}; written again with the same id: replaced)` : ""}`,
    `- write: strom audit add --type <A–L> --code <kind-of-problem> --record P…[,S…] --what "…" --fix "…" --proof ID:"what it says" [--severity error|warning|info] [--suggest-only] [--minutes 5-15]`,
    `- --what, --fix, the summary and the steps' why: in ${langName(lang)}, plain words for the user`,
  ].join("\n");
}

function peopleText(tree: Tree, r: HealthReport): string | undefined {
  const changed = r.changed && r.since ? changedSince(tree, r.since) : undefined;
  const ids = changed ?? scopePeople(tree, r.scope);
  if (!ids.length) return changed ? "## What changed since the last check\nnothing — say so in the summary and close the task" : undefined;
  const named = ids.slice(0, PEOPLE_NAMED).map((id) => {
    const p = tree.get<Person>(id);
    return p && p.type === "person" ? `${id} ${displayName(p)}` : id;
  });
  return [changed ? `## What changed since the last check (${ids.length} records)` : `## The people of the scope (${ids.length})`, named.join(" · "), ids.length > PEOPLE_NAMED ? `(the first ${PEOPLE_NAMED}: go on through strom person list, line by line)` : ""].filter(Boolean).join("\n");
}

function stepsText(r: HealthReport): string | undefined {
  const b = r.builtin as Partial<HealthBuiltin> | undefined;
  if (!b?.steps?.length) return undefined;
  return ["## The built-in steps to order (strom audit order <kind>[:<subject>] --why)", ...b.steps.map((s) => `- ${s.kind}${s.subject ? `:${s.subject}` : ""}${s.count !== undefined ? ` (${s.count})` : ""}`)].join("\n");
}
