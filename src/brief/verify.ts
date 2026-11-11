// The brief of a task of verification against the originals (spec 065, core/verify.ts): each fact on a line as the
// tree has it — its kind, date, place, how sure it is, whose value it is — with the originals it cites and their images,
// and how: the entry read on the image first (blind: another reader, K2.2), then compared; the result with strom verify
// done; a different value never overwritten where it is the user's or a family tree's (spec 066: only proposed); a fact
// the user confirmed against the scan never changed. A search (verify:search, a bulk one's of a family tree's leads):
// the record the citation names found and cited first, within the archives' terms.

import type { Event, Source, Task } from "../core/model.ts";
import type { Tree } from "../core/tree.ts";
import { regionText } from "../core/media.ts";
import { composedPage } from "../core/sourcefields.ts";
import { setsWithImages } from "../core/mediaindex.ts";
import { provesIt } from "../core/evidence.ts";
import { langName } from "../core/lang.ts";
import { isVerifyTask, searchesRecord, taskFacts } from "../core/verifyfacts.ts";
import type { Section } from "./brief.ts";

/** Whose value a fact is (spec 066): the user's or a family tree's is never overwritten, only proposed. */
function whose(e: Event): string | undefined {
  if (!e.origin) return undefined;
  if (e.origin.by === "user") return e.origin.tree ? "the user's family tree's value" : "the user's value";
  return `a family tree's value${e.origin.parts?.length ? ` (${e.origin.parts.join(", ")})` : ""}`;
}

/** A cited source as the line under its fact says it: the original's images and how to look at the entry. */
function sourceLine(tree: Tree, id: string, original: boolean, withImages: Set<string>): string {
  const s = tree.get<Source>(id);
  if (!s || s.type !== "source") return `      ${id} (no longer there)`;
  // where the entry stands: the folio and the image (given) the locator does not say, the locator
  const where = composedPage(s, "en");
  const head = `      ${s.id} ${s.title}${where ? ` · ${where}` : ""}${original ? "" : ` · ${s.kind}, not the original`}`;
  if (!original) return head;
  const looks: string[] = [];
  for (const c of s.clips ?? []) looks.push(`strom media view ${c.media} --crop ${regionText(c.region)}`);
  for (const m of s.media ?? []) if (!(s.clips ?? []).some((c) => c.media === m)) looks.push(`strom media view ${m}`);
  if (s.input) looks.push(`strom media view ${s.input}`);
  if (looks.length) return `${head}\n        the entry: ${looks.join(" · ")}`;
  if (s.recordset && withImages.has(s.recordset)) return `${head}\n        the book ${s.recordset} is here: find the image of ${where ?? "the entry"} (strom source show ${s.id}), then strom media view ${s.recordset}:<n>`;
  return `${head}\n        no image of it here${s.recordset ? ` (${s.recordset})` : ""}: fetched only within the archive's terms (strom fetch … --recordset ${s.recordset ?? "B…"}), else --kept --reason`;
}

/** One line of each fact of the task, the sources it cites under it. */
export function verifyItems(tree: Tree, task: Task): string[] {
  const facts = new Map(taskFacts(tree, task).map((f) => [f.event.id, f]));
  const withImages = setsWithImages(tree);
  const out: string[] = [];
  for (const id of task.where) {
    if (!/^E\p{N}{4,}$/u.test(id)) continue;
    const f = facts.get(id);
    if (!f) {
      out.push(`  ${id} (no longer there)`);
      continue;
    }
    const e = f.event;
    const said = [
      `${e.id} ${e.kind}`,
      e.date ? ` ${e.date}` : "",
      e.place ? `, ${e.place}` : "",
      e.house ? ` ${e.house}` : "",
      e.value ? ` "${e.value}"` : "",
      ` [${e.status}]`,
      ` · ${f.owner.id}`,
    ].join("");
    const marks = [
      e.retracted ? "taken back: nothing to do" : undefined,
      e.confirmed ? `confirmed by the user against the scan ${e.confirmed.at.slice(0, 10)}: theirs — never changed, nothing to do` : undefined,
      e.verified && !e.confirmed ? `verified ${e.verified.at.slice(0, 10)}: ${e.verified.result}${e.verified.reason ? ` — “${e.verified.reason}”` : ""}` : undefined,
      whose(e),
    ].filter(Boolean);
    out.push(`  ${said}${marks.length ? ` · ${marks.join(" · ")}` : ""}`);
    if (!e.citations.length) out.push("      cites nothing");
    for (const sid of [...new Set(e.citations.map((c) => c.source))]) {
      const original = e.citations.some((c) => c.source === sid && provesIt(tree, c));
      out.push(sourceLine(tree, sid, original, withImages));
    }
  }
  return out;
}

/** How, for the agent (English, the reason in the research language). */
function how(tree: Tree, task: Task): string[] {
  const lang = langName(tree.lang);
  const result = [
    `  The same → strom verify done E… --proven --image M… (the image you read it on; B…:n for a book's image).`,
    `  Unsure (the reading, or whether the entry is this person) → strom verify done E… --kept --reason "…" — the reason in`,
    `  ${lang}, the user sees it.`,
    "  A different value: the research's own → strom event edit E… --date … --cite S… --locator … (then verify done);",
    "  the user's or a family tree's value → the same strom event edit only proposes it (a conflict the user decides) —",
    "  never overwritten; then --kept --reason. A fact the user confirmed against the scan is theirs: never changed.",
  ];
  if (searchesRecord(task))
    return [
      "How (no original of these facts was read: a family tree's, an index's, another's reading):",
      "  1. Find the record the citation names (archive, book, page: strom source show S…) — within the archives' terms,",
      "     nothing fetched beyond them; a sharper part of an image only offered to the user, never fetched on your own.",
      "  2. Read the entry yourself, register it (strom source add … --recordset B… --information primary) and cite it:",
      "     strom cite E… S… --locator \"…\" --information primary.",
      "  3. Then compare with the fact:",
      ...result,
      "  Not found: strom search add … (a search in vain is a result), then strom verify done E… --kept --reason \"…\".",
    ];
  return [
    "How:",
    "  1. Read the entry on the image of the original yourself first (strom media view … as above), before the fact and",
    "     the transcript: read blind you are another reader — that is what the verification is worth.",
    "  2. Then compare it with the fact and the source's transcript (strom source show S…).",
    ...result,
  ];
}

/** The section of a task of verification: required, after the task. */
export function verifySection(tree: Tree, task: Task): Section | undefined {
  if (!isVerifyTask(task) || !task.where.length) return undefined;
  return {
    name: "verify",
    required: true,
    pointer: `strom task show ${task.id}`,
    text: [`## To verify (against the originals — each fact ends with strom verify done)`, ...verifyItems(tree, task), "", ...how(tree, task)].join("\n"),
  };
}
