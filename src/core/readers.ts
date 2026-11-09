// Who read a source: the research (a session's model, a reading of a document), the user — and only from a real reading
// of theirs: a transcript the user wrote or ticked verified in the Strom app (Source.app.read), a reading of a document
// confirmed there (Source.reading), the transcript confirmed in the app through the bridge (POST /sources/confirm), or
// a transcript typed by hand at the person's own terminal (Source.read.user). A write of "user" alone is none: an
// import, the conversion of an old research, a batch, a script or an agent strom does not recognise all write as "user".
//
// Until a research is settled (READERS_SETTLED in strom.json, core/readerfix.ts), the history's writes of "user" count
// as before — an older strom's research reads as it did until the fix has run on it (with its backup and its undo).

import { createHash } from "node:crypto";
import type { Event, Source, TreeConfig, UserReading } from "./model.ts";
import type { Tree } from "./tree.ts";
import type { Env } from "./paths.ts";
import { isAgent } from "./which.ts";

/** The marker in strom.json: the readers set right once (core/readerfix.ts) — a write of "user" counts no more. */
export const READERS_SETTLED = "readers-1";

/** Whether the writes of "user" in the history count as the user's readings no more (the readers set right). */
export function readersSettled(tree: Pick<Tree, "config">): boolean {
  return !!tree.config.settled?.includes(READERS_SETTLED);
}

/**
 * The mark of a transcript as strom computes it: the first 16 hex characters of the SHA-256 of its words (NFC). Opaque
 * to the Strom app — it only gives it back (`_TXT`, POST /sources/confirm).
 */
export function transcriptMark(text: string): string {
  return createHash("sha256").update(text.normalize("NFC"), "utf8").digest("hex").slice(0, 16);
}

/**
 * The mark of what a fact says, as the Strom file shows it (`3 _TXT` under `2 _STROM_EID`): its kind, label, date,
 * place, house, cause, value and ages (NFC; never its sources, notes or status). Opaque to the Strom app — it gives it
 * back confirming the fact (POST /facts/confirm), so a confirmation of a value seen in an older file is refused.
 */
export function factMark(e: Pick<Event, "kind" | "label" | "date" | "place" | "house" | "cause" | "value" | "age" | "ages">): string {
  const ages = Object.entries(e.ages ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return transcriptMark(JSON.stringify([e.kind, e.label ?? "", e.date ?? "", e.place ?? "", e.house ?? "", e.cause ?? "", e.value ?? "", e.age ?? "", ages]));
}

/** The mark of a source's transcript, none without one. */
export function markOf(s: Pick<Source, "transcript">): string | undefined {
  return s.transcript?.trim() ? transcriptMark(s.transcript) : undefined;
}

/**
 * The user's reading of a source that still holds: one of the transcript as it is now (a reading of another wording —
 * the research changed the transcript since — counts no more; it stays in the history).
 */
export function userReading(s: Pick<Source, "read" | "transcript">): UserReading | undefined {
  const u = s.read?.user;
  if (!u) return undefined;
  if (u.txt && u.txt !== markOf(s)) return undefined;
  return u;
}

/**
 * The day the user confirmed the transcript as it is now in the Strom app, none when not (or no more): the day of this
 * computer's calendar — the moment is kept in UTC, so a confirmation shortly after midnight is the new day's, never the
 * day before (8 November 2026). Nothing written changes: the day is read from the moment each time.
 */
export function confirmedOn(s: Pick<Source, "read" | "transcript">): string | undefined {
  const u = userReading(s);
  return u?.how === "confirm" ? localDayOf(u.at) : undefined;
}

/** A moment's day on this computer's calendar (YYYY-MM-DD); a day alone, or not a moment: its first ten characters. */
export function localDayOf(at: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/u.test(at)) return at;
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return at.slice(0, 10);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${String(d.getFullYear()).padStart(4, "0")}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/**
 * Whether a transcript written now is the person's own reading, typed by hand: written at the person's terminal (both
 * ends a terminal), by none of the agents strom knows nor the Strom app, outside a batch. An agent strom does not
 * recognise runs strom without a terminal (its shell gives it none): no reading of the user's then.
 */
export function typedByHand(env: Env, o: { tty: boolean; batch?: boolean }): boolean {
  return o.tty && !o.batch && !isAgent(env) && env.STROM_FOR_APP !== "1" && env.STROM_NONINTERACTIVE !== "1" && !env.STROM_SESSION;
}

/** The user's reading of a transcript typed by hand now, as kept on the source. */
export function handReading(transcript: string, at: string): UserReading {
  return { how: "hand", at, txt: transcriptMark(transcript) };
}

/** Writes of "user" this close to each other (in one log) are one run of many: a batch, an import, a script. */
const BULK_GAP_MS = 5000;
/** A run of at least this many writes of "user" is no person typing (one command of a person writes fewer). */
const BULK_RUN = 5;

/**
 * The writes of "user" that were no person's own command: an import (its .import operations), or one of a run of many
 * written close to each other in one log (a batch, the conversion of an old research, a script) — by their signatures.
 * A person typing commands one after another writes far fewer at once.
 */
export function bulkWrites(tree: Pick<Tree, "readOpLogs">): Set<string> {
  const out = new Set<string>();
  for (const log of tree.readOpLogs()) {
    const mine = log.filter((o) => o.by === "user").sort((a, b) => a.at.localeCompare(b.at));
    let run: typeof mine = [];
    const close = () => {
      if (run.length >= BULK_RUN || run.some((o) => o.op.endsWith(".import"))) for (const o of run) out.add(o.sig);
      run = [];
    };
    for (const o of mine) {
      const last = run.at(-1);
      if (last && Date.parse(o.at) - Date.parse(last.at) > BULK_GAP_MS) close();
      run.push(o);
    }
    close();
  }
  return out;
}

/**
 * A fix strom applied by itself kept as set right (strom.json "fixes", as the person's decisions are): strom fixes undo
 * puts it back. A decision already there (the person's) stays.
 */
export function fixedDecision(id: string, version: string): (c: TreeConfig) => void {
  return (c) => {
    if (c.fixes?.[id]) return;
    c.fixes = { ...(c.fixes ?? {}), [id]: { decision: "fixed", at: new Date().toISOString(), version } };
  };
}
