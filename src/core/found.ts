// What each line of the research (G…) found lately: the sessions that worked on it in the last days, the people and
// sources they added. For the Strom app's line (/status researches[].found): read from the operation logs of those
// sessions alone — the day folders of the last days, nothing older opened.

import fs from "node:fs";
import path from "node:path";
import type { Op } from "./tree.ts";
import type { Person, Session, Source } from "./model.ts";
import type { Tree } from "./tree.ts";

/** The days a line's finds cover. */
export const FOUND_DAYS = 7;
/** At most so many people named (the app marks them in the tree). */
export const FOUND_PEOPLE = 50;

export interface Found {
  days: number;
  sessions: number;
  persons: number;
  sources: number;
  people: string[];
}

/**
 * Each line's finds of the last days, by the sessions that worked on it (`lineOf`: a session's own line, else its
 * task's). A line nothing worked on in those days is not in the map, nor one whose sessions added nobody and no source
 * (the app's found is missing when a line has nothing to show).
 */
export function foundByLine(tree: Tree, lineOf: (s: Session) => string | undefined, nowMs = Date.now(), days = FOUND_DAYS): Map<string, Found> {
  const since = new Date(nowMs - days * 86_400_000).toISOString();
  const lineOfSession = new Map<string, string>();
  for (const s of tree.list<Session>("session")) {
    if ((s.ended ?? s.updated ?? s.started) < since) continue;
    const line = lineOf(s);
    if (line) lineOfSession.set(s.id, line);
  }
  const out = new Map<string, Found>();
  if (!lineOfSession.size) return out;
  const added = new Map<string, { persons: Set<string>; sources: Set<string>; sessions: Set<string> }>();
  for (const [sid, line] of lineOfSession) {
    const a = added.get(line) ?? { persons: new Set<string>(), sources: new Set<string>(), sessions: new Set<string>() };
    a.sessions.add(sid);
    added.set(line, a);
  }
  for (const file of recentLogs(path.join(tree.root, "data", "ops"), new Set(lineOfSession.keys()), nowMs, days)) {
    const line = lineOfSession.get(file.session)!;
    const a = added.get(line)!;
    let text: string;
    try {
      text = fs.readFileSync(file.path, "utf8");
    } catch {
      continue;
    }
    for (const row of text.split("\n")) {
      if (!row.includes('"person.add"') && !row.includes('"source.add"')) continue;
      let op: Op;
      try {
        op = JSON.parse(row) as Op;
      } catch {
        continue; // a line being written
      }
      const id = op.targets?.[0];
      if (!id) continue;
      if (op.op === "person.add") {
        const p = tree.get<Person>(id);
        if (p && !p.retracted) a.persons.add(id);
      } else if (op.op === "source.add") {
        const s = tree.get<Source>(id);
        if (s && !s.retracted) a.sources.add(id);
      }
    }
  }
  for (const [line, a] of added)
    if (a.persons.size || a.sources.size) out.set(line,{ days, sessions: a.sessions.size, persons: a.persons.size, sources: a.sources.size, people: [...a.persons].sort().slice(0, FOUND_PEOPLE) });
  return out;
}

/** The operation logs of these sessions written in the last days (and the older one-per-session logs of them). */
function recentLogs(dir: string, sessions: Set<string>, nowMs: number, days: number): { path: string; session: string }[] {
  const out: { path: string; session: string }[] = [];
  const sessionOf = (name: string) => {
    const id = name.split(".")[0]!;
    return sessions.has(id) ? id : undefined;
  };
  for (let d = 0; d <= days + 1; d++) {
    const day = new Date(nowMs - d * 86_400_000).toISOString();
    const folder = path.join(dir, day.slice(0, 7), day.slice(8, 10));
    let names: string[];
    try {
      names = fs.readdirSync(folder);
    } catch {
      continue;
    }
    for (const n of names) {
      const s = n.endsWith(".jsonl") ? sessionOf(n) : undefined;
      if (s) out.push({ path: path.join(folder, n), session: s });
    }
  }
  for (const s of sessions) {
    const older = path.join(dir, `${s}.jsonl`);
    if (fs.existsSync(older)) out.push({ path: older, session: s });
  }
  return out;
}
