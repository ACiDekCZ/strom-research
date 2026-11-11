// The research in the table of the Strom app (its §16.10, the app's ZADANI_VYZKUM_tabulka-vyzkum.md): where each person
// stands among the lines (core/offline.ts personPlaces — the rule the queue places tasks by), what waits outside for
// them (a letter, a question to the family, a site the user looks at: core/waiting.ts) and the people the research
// added and when. Computed from the tree as it is: nothing written. The Strom file carries it (gedcom/export.ts, for an
// app that shows it, APP_SHOWS_RESEARCH_TABLE) and the bridge's GET /directions/people the places live.

import crypto from "node:crypto";
import type { Person, Research, Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import { aboutPeople, scopes, type Scope } from "./directions.ts";
import { personPlaces, readOffline, type Branch, type PersonPlace } from "./offline.ts";
import { actsAsArchive } from "./state.ts";
import { SENDABLE, waitGroupOf, waitKindOf, waitPhaseOf, type WaitGroup, type WaitKind, type WaitPhase } from "./waitkind.ts";

/** A line as the table names it. */
export interface TableLine {
  id: string;
  name: string;
  direction: Research["direction"];
  focus: string;
  state: Research["state"];
}

/** A branch off the lines: its person, the person of a line it hangs on and how, the nearest line, the person's choice. */
export interface TableBranch {
  id: string;
  person: string;
  via: Branch["via"];
  nearest?: string;
  /** The line the person added it to (strom offline set B-… --line G…). */
  line?: string;
  /** The person's own choice of when it is taken (never, occasional, last, normal); none: as the tree says. */
  mode?: string;
}

/** A task about the person that waits for something outside. */
export interface TableWait {
  task: string;
  kind: WaitKind;
  /** What the task is (its words as the research wrote them). */
  what: string;
  /** What it waits for. */
  on: string;
  group: WaitGroup;
  phase: WaitPhase;
  /** When the request went out (phase sent). */
  sent?: string;
  priority: number;
}

export interface TableMarks {
  lines: TableLine[];
  branches: TableBranch[];
  /** Each person's places among the lines (a person outside them all is absent). */
  places: Map<string, PersonPlace[]>;
  /** The waiting tasks about each person (its people, the partners of its families, the people of its conflicts and hypotheses). */
  waits: Map<string, TableWait[]>;
  /** When the research added each person it added (its primary name of its own: no import, not the user's). */
  added: Map<string, string>;
}

/** The places of a person as JSON: the bridge's /directions/people `places` and what the GEDCOM says the same. */
export function placesJson(places: Map<string, PersonPlace[]>): Record<string, PersonPlace[]> {
  return Object.fromEntries([...places].map(([p, at]) => [p, at.map((x) => ({ ...(x.line ? { line: x.line } : {}), role: x.role, ...(x.branch ? { branch: x.branch } : {}) }))]));
}

/** The lines and branches of the research as they stand (the table's and the bridge's). */
export function directionsOf(tree: Tree, all: Scope[] = scopes(tree)): { lines: TableLine[]; branches: TableBranch[]; places: Map<string, PersonPlace[]> } {
  const file = readOffline(tree);
  const placed = personPlaces(tree, all, file);
  const lines = [...placed.lines]
    .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }))
    .map((r) => ({ id: r.id, name: r.name.normalize("NFC"), direction: r.direction, focus: r.focus, state: r.state }));
  const ids = new Set(lines.map((l) => l.id));
  const branches = [...placed.branches.values()].map((b) => {
    const c = file.branches[b.person];
    return {
      id: b.id,
      person: b.person,
      via: b.via,
      ...(b.nearest ? { nearest: b.nearest } : {}),
      ...(c?.mode === "line" && c.line && ids.has(c.line) ? { line: c.line } : {}),
      ...(c && c.mode !== "line" ? { mode: c.mode } : {}),
    };
  });
  return { lines, branches, places: placed.people };
}

/** A fingerprint of the lines, the branches and every person's places: it changes when any of them does. */
export function directionsRev(d: { lines: TableLine[]; branches: TableBranch[]; places: Map<string, PersonPlace[]> }): string {
  const what = JSON.stringify({ lines: d.lines, branches: d.branches, places: Object.entries(placesJson(d.places)).sort(([a], [b]) => a.localeCompare(b)) });
  return crypto.createHash("sha256").update(what).digest("hex").slice(0, 16);
}

/** When a record was made, to the second in UTC; undefined when it says no time. */
function whenOf(at: string | undefined): string | undefined {
  const t = at ? Date.parse(at) : NaN;
  return Number.isFinite(t) ? `${new Date(t).toISOString().slice(0, 19)}Z` : undefined;
}

/** What the table of the Strom app shows of the research (the Strom file of an app that shows it). */
export function tableMarks(tree: Tree): TableMarks {
  const { lines, branches, places } = directionsOf(tree);
  const waits = new Map<string, TableWait[]>();
  // an archive (a research waiting for its agent too) asks nobody anything: nothing waits (core/waiting.ts)
  if (!actsAsArchive(tree))
    for (const t of tree.list<Task>("task")) {
      if (t.retracted || t.state !== "waiting" || t.proposal) continue;
      const kind = waitKindOf(t);
      const phase = SENDABLE.includes(kind) ? waitPhaseOf(t) : "todo";
      const wait: TableWait = {
        task: t.id,
        kind,
        what: t.what.normalize("NFC"),
        on: (t.waitingOn ?? "").normalize("NFC"),
        group: waitGroupOf(tree, t),
        phase,
        ...(phase === "sent" && t.sent ? { sent: t.sent.at } : {}),
        priority: t.priority,
      };
      for (const p of aboutPeople(tree, t.subject)) {
        const at = waits.get(p) ?? [];
        at.push(wait);
        waits.set(p, at);
      }
    }
  const added = new Map<string, string>();
  for (const p of tree.list<Person>("person")) {
    if (p.retracted) continue;
    const name = p.names.find((n) => n.primary) ?? p.names[0];
    const at = whenOf(p.created);
    if (name && !name.origin && at) added.set(p.id, at);
  }
  return { lines, branches, places, waits, added };
}
