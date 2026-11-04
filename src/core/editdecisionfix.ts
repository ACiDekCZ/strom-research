// strom fixes edit-decisions: a disagreement between the research and the user's own edit in the Strom app that an agent
// decided before strom refused it (an open conflict of the user's edit is the user's alone, unless the user left it to
// the agent: strom conflict leave) — set right by rules: each opened again for the user's decision, what the agent
// decided kept in a note on it and in EDIT_DECISIONS_FILE for the undo. No fact is touched: the user's value stays one
// of its claims, deciding it again goes as any decision. Free, one operation, kept for its undo.
// Left as they are (said why): one whose user's value the agent took (the fact holds it already — the user's word
// stands), and one the agent decided again after the user had decided it, on a source the user's decision did not weigh
// (allowed then and now).

import fs from "node:fs";
import path from "node:path";
import { isEditConflict } from "./conflicts.ts";
import { NOTE_MAX, type Conflict, type Note, type TreeConfig } from "./model.ts";
import { phrase } from "./phrases.ts";
import { now, type Tree } from "./tree.ts";

/** Where the fix keeps what it changed, for its undo (sealed like the rest of quality/; travels with the research). */
export const EDIT_DECISIONS_FILE = "quality/edit-decisions.json";

/** The version of strom from which an agent may no longer decide a conflict of the user's own edit. */
export const EDIT_DECISIONS_SINCE = "1.26.0";

/** A conflict's decision as the agent left it: what the fix takes off it, and the undo puts back. */
export interface AgentDecision {
  resolution?: string;
  reasoning?: string;
  decidedAt?: string;
  taken?: "user" | "research";
}

/** One conflict opened again: its people, its title, the agent's decision, and when the record was last changed before. */
export interface EditDecisionFix {
  conflict: string;
  subject: string[];
  title: string;
  decided: AgentDecision;
  /** The conflict's `updated` before the fix (the undo puts it back as it was). */
  updated: string;
}

/** One left as it is: the user's value taken (`user`), or decided again on a new source after the user's decision (`again`). */
export interface EditDecisionLeft {
  conflict: string;
  subject: string[];
  title: string;
  why: "user" | "again";
}

export interface EditDecisionFindings {
  fixes: EditDecisionFix[];
  left: EditDecisionLeft[];
}

interface DecisionsFile {
  v: 1;
  /** Each time the fix set things right, newest last. */
  runs: { at: string; version: string; items: EditDecisionFix[] }[];
}

/** The note strom writes on a decision made again (commands/analysis.ts conflict resolve): the user had decided it before. */
const AGAIN_AFTER_USER = "earlier decided by the user";

/** What an agent decided of the user's own edits in the Strom app, without the user leaving it to the agent. */
export function editDecisionFixes(tree: Tree): EditDecisionFindings {
  const out: EditDecisionFindings = { fixes: [], left: [] };
  const conflicts = tree
    .list<Conflict>("conflict")
    .filter((c) => c.state === "resolved" && !c.retracted && c.decidedBy === "agent" && !c.leftToAgent && c.decidedIn !== "app" && isEditConflict(c))
    .sort((a, b) => (a.decidedAt ?? "").localeCompare(b.decidedAt ?? "") || a.id.localeCompare(b.id));
  for (const c of conflicts) {
    const said = { conflict: c.id, subject: [...c.subject], title: c.title };
    // the user's value taken: the fact holds it already — the user's word stands (opened again, deciding for the
    // research would leave the fact as the user's)
    if (c.taken === "user") out.left.push({ ...said, why: "user" });
    // decided again after the user's own decision, on a source it did not weigh: allowed then and now
    else if (c.notes.some((n) => n.text.startsWith(AGAIN_AFTER_USER))) out.left.push({ ...said, why: "again" });
    else
      out.fixes.push({
        ...said,
        decided: {
          ...(c.resolution !== undefined ? { resolution: c.resolution } : {}),
          ...(c.reasoning !== undefined ? { reasoning: c.reasoning } : {}),
          ...(c.decidedAt !== undefined ? { decidedAt: c.decidedAt } : {}),
          ...(c.taken ? { taken: c.taken } : {}),
        },
        updated: c.updated,
      });
  }
  return out;
}

/** Conflicts of the user's own edit an agent decided (strom check: agent-decided-edit). */
export function editDecisions(tree: Tree): { count: number; first?: string } {
  const f = editDecisionFixes(tree).fixes;
  return { count: f.length, ...(f.length ? { first: f[0]!.conflict } : {}) };
}

function readFile(tree: Tree): DecisionsFile {
  try {
    const f = JSON.parse(fs.readFileSync(path.join(tree.root, ...EDIT_DECISIONS_FILE.split("/")), "utf8")) as Partial<DecisionsFile>;
    return { v: 1, runs: Array.isArray(f.runs) ? f.runs : [] };
  } catch {
    return { v: 1, runs: [] };
  }
}

const fileContent = (f: DecisionsFile) => JSON.stringify(f, null, 2) + "\n";

/** A text cut to at most `max` characters, "…" where cut. */
const cut = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

/** The note the fix leaves on a conflict it opens again: what the agent decided, in the research's language. */
function noteOf(tree: Tree, it: EditDecisionFix, at: string): Note {
  const decided = [cut(it.decided.resolution ?? "", 160), cut(it.decided.reasoning ?? "", 200)].filter((x) => x.trim()).join(" — ");
  const text = phrase(tree.lang, "fix.editdecision.note", { since: EDIT_DECISIONS_SINCE, decided: decided || "—" });
  return { text: cut(text, NOTE_MAX), at, by: tree.actor };
}

/**
 * The fix: each conflict found opened again for the user's decision, the agent's decision in a note on it — one
 * operation, what it changed kept for its undo (EDIT_DECISIONS_FILE). One changed since it was found is left and counted.
 * Inside withTreeLock.
 */
export function applyEditDecisions(tree: Tree, items: EditDecisionFix[], version: string, config?: (c: TreeConfig) => void): { changed: number; records: number; left: number } {
  const at = now();
  const records: Conflict[] = [];
  const done: EditDecisionFix[] = [];
  let left = 0;
  for (const it of items) {
    const was = tree.get<Conflict>(it.conflict);
    // still as it was found: decided by the agent, never touched since
    if (!was || was.state !== "resolved" || was.decidedBy !== "agent" || was.leftToAgent || was.updated !== it.updated) {
      left++;
      continue;
    }
    const x = structuredClone(was);
    x.state = "open";
    for (const k of ["resolution", "reasoning", "decidedBy", "decidedIn", "decidedAt", "taken"] as const) delete x[k];
    x.notes = [...x.notes, noteOf(tree, it, at)];
    x.updated = at;
    records.push(x);
    done.push(it);
  }
  if (!done.length) return { changed: 0, records: 0, left };
  const file = readFile(tree);
  file.runs.push({ at, version, items: done });
  tree.putMany(
    records,
    [{ rel: EDIT_DECISIONS_FILE, content: fileContent(file) }],
    { op: "editdecision.fix", targets: records.map((r) => r.id).sort(), summary: `disagreements of the user's own edit an agent decided opened again for the user: ${done.length} in ${records.length} records (fix edit-decisions)` },
    config,
  );
  return { changed: done.length, records: records.length, left };
}

/** What the fix opened again and is not undone yet. */
export function editDecisionsDone(tree: Tree): EditDecisionFix[] {
  return readFile(tree).runs.flatMap((r) => r.items);
}

/**
 * The fix undone: each conflict closed again exactly as the agent left it (its decision, its notes, when it was last
 * changed) — where still as the fix left it (open, nothing changed since: decided again, a newer word of the user, a
 * note); one changed since is left and counted. One operation; what the fix kept is emptied.
 */
export function undoEditDecisions(tree: Tree, config?: (c: TreeConfig) => void): { restored: number; records: number; left: number } {
  const file = readFile(tree);
  if (!file.runs.some((r) => r.items.length)) return { restored: 0, records: 0, left: 0 };
  const records: Conflict[] = [];
  let left = 0;
  // newest run first
  for (const run of [...file.runs].reverse())
    for (const it of run.items) {
      const was = tree.get<Conflict>(it.conflict);
      const note = was?.notes.at(-1);
      if (!was || was.state !== "open" || was.updated !== run.at || note?.at !== run.at || records.some((r) => r.id === it.conflict)) {
        left++;
        continue;
      }
      const x = structuredClone(was);
      x.state = "resolved";
      if (it.decided.resolution !== undefined) x.resolution = it.decided.resolution;
      if (it.decided.reasoning !== undefined) x.reasoning = it.decided.reasoning;
      x.decidedBy = "agent";
      if (it.decided.decidedAt !== undefined) x.decidedAt = it.decided.decidedAt;
      if (it.decided.taken) x.taken = it.decided.taken;
      x.notes = x.notes.slice(0, -1);
      x.updated = it.updated;
      records.push(x);
    }
  tree.putMany(
    records,
    [{ rel: EDIT_DECISIONS_FILE, content: fileContent({ v: 1, runs: [] }) }],
    { op: "editdecision.unfix", targets: records.map((r) => r.id).sort(), summary: `disagreements of the user's own edit closed again as the agent decided them: ${records.length} in ${records.length} records${left ? `, ${left} changed since left` : ""} (fix edit-decisions undone)` },
    config,
  );
  return { restored: records.length, records: records.length, left };
}
