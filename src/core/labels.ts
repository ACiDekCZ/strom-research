// A batch's labels ("#s" ends the line that creates a record, "@s" names it later) and what a strom before 1.29.0 left
// of them in a conflict's claim: "@s: aged 27" kept as written, the source it named not cited (found by the Strom
// app's tester: the raw "@s:" in the app's dialog and in the GEDCOM). Such a claim is read as the claim of the source
// its batch created — found in the history of that one change — and its value without the label; nothing is
// rewritten in the record.

import fs from "node:fs";
import path from "node:path";
import type { Conflict } from "./model.ts";
import type { Op, Tree } from "./tree.ts";

/** A label: a word in any script ("anna", "šimon", "otec_2"), its accents composed or not. */
export const LABEL = "[\\p{L}_][\\p{L}\\p{M}\\p{N}_-]*";

/** A claim that begins with a label before its colon: "@s: aged 27", "@s : aged 27", "@ s:aged 27". */
const LEADING_LABEL = new RegExp(`^\\s*@\\s*(${LABEL})\\s*:\\s*`, "u");

/** The label a claim's value begins with, and the value after it; undefined when it begins with none. */
export function leadingLabel(value: string): { label: string; rest: string } | undefined {
  const m = LEADING_LABEL.exec(value);
  return m ? { label: m[1]!.normalize("NFC"), rest: value.slice(m[0].length) } : undefined;
}

type Claim = Conflict["claims"][number];

/** Per tree: the sources each conflict's own change created (its batch's), read once from the history. */
const createdWith = new WeakMap<Tree, Map<string, string[]>>();

/**
 * A claim as strom reads it: one an older strom left with a batch's label in its value (no source) — its value
 * without the label, and the source the label named: one by its ID ("@S0012:"), else the one source the conflict's
 * own change created (the batch both were in). More sources there, or none: no source guessed, only the label taken
 * off. Any other claim as it is (the same object).
 */
export function settledClaim(tree: Tree, c: Conflict, claim: Claim): Claim {
  // a claim of the user's edit, or one strom wrote with a note, is never one of a batch: as it is
  if (claim.source || claim.note) return claim;
  const lead = leadingLabel(claim.value);
  if (!lead) return claim;
  const byId = /^[Ss]\d{4,}$/u.test(lead.label) ? lead.label.toUpperCase() : undefined;
  const ofBatch = byId && tree.get(byId)?.type === "source" ? [byId] : sourcesCreatedWith(tree, c);
  const text = claim.text !== undefined ? (leadingLabel(claim.text)?.rest ?? claim.text) : undefined;
  return { ...claim, value: lead.rest, ...(text !== undefined ? { text } : {}), ...(ofBatch.length === 1 && tree.get(ofBatch[0]!)?.type === "source" ? { source: ofBatch[0]! } : {}) };
}

/**
 * The sources created by the change that created a record: the operation log of that one commit (one batch, one
 * process — ops/<yyyy-mm>/<dd>/<name>.<time>-<random>.jsonl), looked for in the day the record was made and the one
 * before (a batch begun before midnight). The older logs of a month or a session hold many changes: nothing is read
 * from them.
 */
function sourcesCreatedWith(tree: Tree, rec: { id: string; created: string }): string[] {
  let known = createdWith.get(tree);
  if (!known) createdWith.set(tree, (known = new Map()));
  const had = known.get(rec.id);
  if (had) return had;
  const out: string[] = [];
  const made = Date.parse(rec.created);
  const days = Number.isNaN(made) ? [] : [made, made - 86_400_000].map((t) => new Date(t).toISOString());
  search: for (const day of days) {
    const dir = path.join(tree.dataDir, "ops", day.slice(0, 7), day.slice(8, 10));
    let files: string[] = [];
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }
    for (const f of files) {
      const ops = readOps(path.join(dir, f));
      if (!ops.some((o) => o.targets?.[0] === rec.id && new RegExp(`^\\+${rec.id}(?!\\p{N})`, "u").test(o.summary ?? ""))) continue;
      for (const o of ops) {
        const id = /^\+(S\d{4,})(?!\p{N})/u.exec(o.summary ?? "")?.[1];
        if (id && o.targets?.[0] === id && !out.includes(id)) out.push(id);
      }
      break search;
    }
  }
  known.set(rec.id, out);
  return out;
}

/** The operations of one log; a line that cannot be read skipped (strom check says it). */
function readOps(file: string): Partial<Op>[] {
  let text = "";
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const out: Partial<Op>[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as Partial<Op>);
    } catch {
      // unreadable: left to strom check
    }
  }
  return out;
}
