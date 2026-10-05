// The operation logs of a research: where they are and in which order they were written.

import fs from "node:fs";
import path from "node:path";

/**
 * Every operation log of a research, oldest first: the older ones (ops/<name>.jsonl, one per month or session), then
 * those of each commit by their day and time (ops/<yyyy-mm>/<dd>/<name>.<time>-<random>.jsonl).
 */
export function opsLogs(dataDir: string): string[] {
  const dir = path.join(dataDir, "ops");
  let top: string[] = [];
  try {
    top = fs.readdirSync(dir).sort();
  } catch {
    return [];
  }
  const older = top.filter((n) => n.endsWith(".jsonl")).map((n) => path.join(dir, n));
  const daily: string[] = [];
  for (const month of top.filter((n) => /^\d{4}-\d{2}$/.test(n)))
    for (const day of list(path.join(dir, month)).filter((n) => /^\d{2}$/.test(n)))
      for (const f of list(path.join(dir, month, day))) if (f.endsWith(".jsonl")) daily.push(path.join(dir, month, day, f));
  // within a day by time, whoever wrote it
  const when = (f: string) => path.basename(f).split(".").at(-2) ?? "";
  daily.sort((a, b) => path.dirname(a).localeCompare(path.dirname(b)) || when(a).localeCompare(when(b)));
  return [...older, ...daily];
}

/** The operation logs of one actor or session (`N0007`, `user-2026-10`), oldest first. */
export function opsLogsOf(dataDir: string, name: string): string[] {
  return opsLogs(dataDir).filter((f) => {
    const b = path.basename(f);
    return b === `${name}.jsonl` || b.startsWith(`${name}.`);
  });
}

function list(dir: string): string[] {
  try {
    return fs.readdirSync(dir).sort();
  } catch {
    return [];
  }
}
