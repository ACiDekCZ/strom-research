// A transcript the person read or confirmed is never changed by anyone else (spec 065 K2.3: what a person confirmed is
// not overwritten). One check where every record is written (Tree.put, Tree.putMany): a source whose transcript holds
// the person's reading (Source.read.user, as core/readers.ts userReading counts it) changes its words only by the
// person — their own terminal, or the Strom app through its bridge. Anyone else's change is refused there, whatever
// the command (an edit, a batch, a sync, a fix, an undo); an agent's edit of the transcript becomes a proposal the
// person decides instead (core/proposal.ts). The person's decision itself — a task of the proposal — changes its state
// only by the person too. Pure: no records read here, the Tree gives both versions.

import type { AnyRecord, Source, Task } from "./model.ts";
import type { Env } from "./paths.ts";
import { UsageError } from "./errors.ts";
import { userReading } from "./readers.ts";
import { isAgent } from "./which.ts";

/**
 * Whether a strom writes as the person: the Strom app's bridge writing the person's action there (STROM_FOR_APP, never
 * with an agent's marks), or the person's own terminal — a terminal that can be asked (`interactive`), no agent strom
 * knows, no session of one. Anything else is an agent, also one strom does not recognise (its shell gives it no
 * terminal): when unsure, protected.
 */
export function writesAsPerson(env: Env, interactive: boolean): boolean {
  if (isAgent(env)) return false;
  if (env.STROM_FOR_APP === "1") return true;
  return interactive && env.STROM_NONINTERACTIVE !== "1" && !env.STROM_SESSION;
}

/** Two transcripts' words differ (none and an empty one are the same: no words). */
export function transcriptDiffers(a: string | undefined, b: string | undefined): boolean {
  return (a ?? "").normalize("NFC") !== (b ?? "").normalize("NFC");
}

/** How the person's reading came, in a few words for an agent. */
export function readingWords(s: Pick<Source, "read" | "transcript">): string {
  const u = userReading(s);
  if (!u) return "";
  const how = u.how === "hand" ? "typed by hand at their terminal" : u.how === "confirm" ? "confirmed in the Strom app" : "their reading from before";
  return `${how}, ${u.at.slice(0, 10)}`;
}

/**
 * The refusal of a write that changes what is the person's, by someone who is not the person: the confirmed transcript
 * of a source changed, or the state of a task of a proposed transcript (the person's decision). None: the write may go.
 */
export function refusedWrite(prev: AnyRecord | undefined, next: AnyRecord, person: boolean): UsageError | undefined {
  if (person || !prev || prev.type !== next.type) return undefined;
  if (next.type === "source") {
    const p = prev as Source;
    const n = next as Source;
    if (!userReading(p) || !transcriptDiffers(p.transcript, n.transcript)) return undefined;
    return new UsageError(`the transcript of ${p.id} is the person's own reading (${readingWords(p)}) — only the person changes it; nothing written`, {
      hint: `propose the new wording instead (the person decides it): strom source edit ${p.id} --transcript "<the new wording>" --reason "<why>"`,
      code: "source.transcript.confirmed",
      params: { source: p.id },
    });
  }
  if (next.type === "task") {
    const p = prev as Task;
    const n = next as Task;
    if (!p.proposal) return undefined;
    // a research kept as an archive puts every waiting task aside and back (core/mode.ts): no decision of anyone's
    const held = n.heldBy === "archive" || p.heldBy === "archive";
    if ((n.state === p.state && n.proposal) || held) return undefined;
    return new UsageError(`${p.id} is the person's decision on a new wording proposed for the transcript of ${p.proposal.source} — only the person takes it or keeps the transcript (strom's menu, What waits; the Strom app); nothing written`, {
      hint: "go on with other work; the person decides it",
      code: "task.proposal.person",
      params: { task: p.id, source: p.proposal.source },
    });
  }
  return undefined;
}
