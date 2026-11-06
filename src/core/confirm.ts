// The user confirming the research's transcript of a source in the Strom app (spec 022 P2): "I read it from the scan,
// it agrees" — the user's reading of that wording (Source.read.user, how "confirm", with its mark), taken back the same
// way. Only through the bridge (POST <token>/sources/confirm), which runs strom source confirm as the person's in the
// app; nobody else confirms for a person. A confirmation holds for the wording it was of: once the research changes
// the transcript it counts no more (core/readers.ts userReading) and stays in the history alone.

import type { Source } from "./model.ts";
import type { Tree } from "./tree.ts";
import { confirmedOn, markOf } from "./readers.ts";
import { readersOf } from "./review.ts";
import { actsAsArchive } from "./state.ts";
import { isOriginalHere } from "./evidence.ts";

/** Who read a source as the Strom file says it (1 _STROM_READ): none when nobody did. */
export type ReadBy = "user" | "research" | "both";

/** What the app is answered: the source, who read it now, the day the user confirmed it (while that holds), its wording. */
export interface ConfirmAnswer {
  source: string;
  read?: ReadBy;
  conf?: string;
  txt: string;
}

/** A confirmation refused: the HTTP status the app reads it by, its code, the sentence, what goes with it. */
export interface ConfirmRefusal {
  status: 404 | 409;
  code: "confirm.archive" | "confirm.none" | "confirm.merged" | "confirm.retracted" | "confirm.reader" | "confirm.changed";
  why: string;
  params?: Record<string, string>;
}

/** Who read a source by its readers (core/review.ts readersOf): the user, the research (any model), both. */
export function readBy(who: Set<string> | undefined): ReadBy | undefined {
  const user = !!who?.has("user");
  const research = [...(who ?? [])].some((x) => x !== "user");
  return user && research ? "both" : user ? "user" : research ? "research" : undefined;
}

/** The answer for a source as the research has it now. */
export function confirmAnswer(tree: Tree, id: string): ConfirmAnswer {
  const s = tree.get<Source>(id)!;
  const read = readBy(readersOf(tree).get(id));
  const conf = confirmedOn(s);
  return { source: id, ...(read ? { read } : {}), ...(conf ? { conf } : {}), txt: markOf(s) ?? "" };
}

/**
 * A confirmation (or its taking back) of the wording `txt` checked against the research as it is now: refused, the
 * same state already (nothing to write), or the source as it is to be written.
 */
export function confirmCheck(tree: Tree, id: string, txt: string, confirm: boolean): { refused: ConfirmRefusal } | { same: ConfirmAnswer } | { write: Source } {
  if (actsAsArchive(tree)) return { refused: { status: 409, code: "confirm.archive", why: "an archive: nothing of a source is confirmed here" } };
  const s = tree.get<Source>(id);
  if (!s || s.type !== "source") return { refused: { status: 404, code: "confirm.none", why: `no source ${id} in the research`, params: { source: id } } };
  if (s.mergedInto) return { refused: { status: 409, code: "confirm.merged", why: `${id} is merged into ${s.mergedInto}`, params: { source: id, into: s.mergedInto } } };
  // a source taken out: nothing confirmed on it any more — a confirmation it had is taken back still
  const conf = confirmedOn(s);
  if (s.retracted && confirm) return { refused: { status: 409, code: "confirm.retracted", why: `${id} is taken out of the research: nothing to confirm`, params: { source: id } } };
  const mark = markOf(s);
  if (!mark) return { refused: { status: 409, code: "confirm.reader", why: `${id} has no transcript to confirm`, params: { source: id } } };
  if (txt !== mark) return { refused: { status: 409, code: "confirm.changed", why: `the transcript of ${id} changed since: confirm its new wording`, params: { source: id, txt: mark } } };
  const who = readersOf(tree).get(id);
  if (conf) return confirm ? { same: confirmAnswer(tree, id) } : { write: unconfirmed(s) };
  // the research's reading is what is confirmed; the user's own reading of another kind is no confirmation to take back
  const research = [...(who ?? [])].some((x) => x !== "user");
  if (!research || who?.has("user")) return { refused: { status: 409, code: "confirm.reader", why: `${id} is ${research ? "read by the user already" : "not read by the research"}: nothing to ${confirm ? "confirm" : "take back"}`, params: { source: id } } };
  if (!confirm) return { same: confirmAnswer(tree, id) };
  return { write: { ...structuredClone(s), read: { ...s.read, user: { how: "confirm", at: new Date().toISOString(), txt: mark } } } };
}

/** The source without the user's confirmation (their reading of another kind stays). */
function unconfirmed(s: Source): Source {
  const next = structuredClone(s);
  if (next.read?.user?.how === "confirm") delete next.read.user;
  if (next.read && !Object.keys(next.read).length) delete next.read;
  return next;
}

/**
 * What a confirmation does to how sure the source's facts may be (spec 022 O6): the user's reading of the original
 * record with primary information may make a fact proven; of anything else at most probable.
 */
export function confirmProves(s: Source): boolean {
  return isOriginalHere(s) && s.information === "primary";
}

/** The summary of the operation (the changes line reads it: core/changelog.ts). */
export function confirmSummary(s: Source, confirm: boolean): string {
  if (!confirm) return `${s.id}: the user's confirmation of the transcript taken back in the Strom app`;
  return `${s.id}: transcript confirmed by the user in the Strom app — ${confirmProves(s) ? "the original record with primary information: a fact of it may be proven" : "not the original record with primary information: its facts at most probable"}`;
}
