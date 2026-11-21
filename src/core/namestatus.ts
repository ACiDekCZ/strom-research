// How sure a person's name is (spec 066 P5): a name has a status as a fact has, drawn from the records that name the
// person. Any name may have one; the name of a person's identity (primaryName — the first NAME of the Strom file) alone
// carries the person's confirmation against the scan (`confirmed`), an agent's verification (`verified`) and the bridge's
// id (`P0012.N`, nameEid) the Strom app gives back confirming it.
//
// - `strom cite P… S… --status`, `name add … --cite … --status`, `person add … --cite … --name-status` set it,
//   with the checks of a fact's (checkStatus: proven needs the original record itself);
// - a citation without a status makes a name with none probable when the record is one of the research's (QUAY 2 or 3,
//   no index or compiled work) — never a name the person confirmed or wrote (origin user): theirs as it is;
// - the person's confirmed name: its status is theirs, an agent asking for another is refused (event.confirmed).
//
// For subagent B (the bridge, verification): `nameEid`/`parseNameEid` are the ids, `nameMark` (readers.ts) the mark of
// its words; `confirmName` the person's confirmation as a sync and the bridge write it.

import { NAME_STATUSES, type Citation, type Name, type Person, type Source, type Status, type Task } from "./model.ts";
import { UsageError } from "./errors.ts";
import { checkStatus, isWeak, quay } from "./evidence.ts";
import { primaryName } from "./people.ts";
import { nameMark } from "./readers.ts";
import { now, type Tree } from "./tree.ts";

export { NAME_STATUSES };

/** The bridge's id of the name of a person's identity: `P0012.N` (the Strom file's `2 _STROM_EID` under its NAME). */
export const nameEid = (p: Pick<Person, "id">): string => `${p.id}.N`;

/** The person an id of a name gives (`P0012.N`, any case, spaces around it), undefined for any other id. */
export function parseNameEid(ref: string | undefined): string | undefined {
  const m = /^\s*p(\d{1,12})\.n\s*$/iu.exec(ref ?? "");
  return m ? `P${m[1]!.padStart(4, "0")}` : undefined;
}

/** A status of a name as given (--status, --name-status): undefined when none is given. */
export function parseNameStatus(v: string | undefined): Status | undefined {
  if (v === undefined) return undefined;
  if (!(NAME_STATUSES as readonly string[]).includes(v)) throw new UsageError(`invalid status of a name "${v}"`, { hint: `use ${NAME_STATUSES.join(", ")} (a name found wrong: strom name retract)` });
  return v as Status;
}

/**
 * A record of the research's that names the person: QUAY 2 or 3 (an original, or a copy of primary information), no
 * index or compiled work — never a source of the Strom app the research never read (the user's word for it).
 */
export function namesThePerson(tree: Pick<Tree, "get">, c: Citation): boolean {
  const s = tree.get<Source>(c.source);
  return !!s && !s.retracted && !isWeak(s) && (!s.app || !!s.reading) && quay(s, c) >= 2;
}

/** The person's own name: confirmed against the scan, or written by them (origin user) — its status is never told for them. */
export const usersName = (n: Pick<Name, "confirmed" | "origin">): boolean => !!n.confirmed || n.origin?.by === "user";

/**
 * The status a name has once it cites one more record: the one asked for (checked as a fact's against all its
 * citations), else probable for a name with none that a record of the research's names (namesThePerson) — never the
 * person's own name (usersName) — else what it had.
 */
export function nameStatusAfter(tree: Tree, name: Name, citations: readonly Citation[], cited: Citation | undefined, asked: Status | undefined): Status | undefined {
  if (asked) {
    checkStatus(tree, asked, [...citations]);
    return asked;
  }
  if (name.status || usersName(name) || !cited || !namesThePerson(tree, cited)) return name.status;
  return "probable";
}

/**
 * An agent never changes the status of a name the person confirmed against the scan (the name of their identity): asked
 * for another, refused with what to run instead (as a fact's: the same status again passes). The person's own writes
 * (Tree.personWrites) may.
 */
export function refuseConfirmedName(tree: Tree, p: Person, name: Name, asked: Status | undefined, source: string): void {
  if (!asked || asked === name.status || !name.confirmed || tree.personWrites || name !== primaryName(p)) return;
  throw new UsageError(`the name of ${p.id} was confirmed by the user against the scan: its status is theirs, not changed by an agent`, {
    code: "event.confirmed",
    hint: `strom cite ${p.id} ${source} without --status`,
  });
}

/** A name with its status set (none: taken off). */
export function withNameStatus(n: Name, status: Status | undefined): Name {
  if (status === n.status) return n;
  if (status) return { ...n, status };
  const { status: _s, ...rest } = n;
  return rest;
}

/** What a confirmation of a name did: the person, the day it is confirmed on (none: taken back), the same state again. */
export interface NameConfirmResult {
  person: string;
  name: string;
  confirmed?: string;
  same?: true;
}

/**
 * A confirmation is of the name the person saw (the Strom file's `3 _TXT` under `2 _STROM_EID P….N`, readers.ts
 * nameMark): the name changed since — the app showing an older file — refused, confirm.changed with the mark now.
 */
export function nameUnchanged(p: Person, txt: string): void {
  const n = primaryName(p);
  const mark = nameMark(n);
  if (txt.trim().toLowerCase() !== mark)
    throw new UsageError(`the name of ${p.id} changed since the app showed it: confirm what it says now`, {
      code: "confirm.changed",
      hint: "load the tree again and confirm the name as it is now",
      params: { fact: nameEid(p), txt: mark, given: n.given, surname: n.surname },
    });
}

/**
 * The person's confirmation of the name of someone's identity against the scan (or its taking back), as a fact's
 * (verify.ts verifyConfirm): a mark of its own, the status as it is; the same state again: nothing written. One
 * operation; the caller has checked it is the person. `day`: the day the person confirmed it (a send of the Strom app,
 * YYYY-MM-DD) — a day before today kept, else now; `txt`: the mark of the name the person saw, checked under the lock;
 * `tasks`: the tasks of verification the name leaves (core/verify.ts verifyConfirm), written in the same operation.
 */
export function confirmName(tree: Tree, id: string, confirm: boolean, opts: { day?: string; reason?: string; txt?: string; tasks?: Task[] } = {}): NameConfirmResult {
  return tree.withTreeLock(() => {
    const p = tree.get<Person>(id);
    if (!p || p.type !== "person" || p.mergedInto || p.retracted) throw new UsageError(`no person ${id}`, { code: "record.none", params: { kind: "person", id } });
    if (opts.txt !== undefined) nameUnchanged(p, opts.txt);
    const name = primaryName(p);
    const i = p.names.indexOf(name);
    if (i < 0) throw new UsageError(`${id} has no name to confirm`, { code: "record.none", params: { kind: "name", id } });
    if (!!name.confirmed === confirm) return { person: id, name: nameEid(p), ...(name.confirmed ? { confirmed: name.confirmed.at.slice(0, 10) } : {}), same: true as const };
    const at = now();
    const day = opts.day && /^\d{4}-\d{2}-\d{2}$/.test(opts.day) && opts.day < at.slice(0, 10) && !Number.isNaN(Date.parse(`${opts.day}T12:00:00.000Z`)) ? `${opts.day}T12:00:00.000Z` : at;
    const { confirmed: _c, ...rest } = name;
    const next: Name = confirm ? { ...name, confirmed: { at: day, by: "user" } } : rest;
    const tasks = opts.tasks ?? [];
    tree.putMany([{ ...p, names: p.names.map((n, j) => (j === i ? next : n)), updated: at }, ...tasks], [], {
      op: confirm ? "name.confirm" : "name.unconfirm",
      targets: [id, ...tasks.map((t) => t.id)],
      summary: confirm ? `${id} the name of their identity confirmed by the person against the scan` : `${id} the person's confirmation of the name of their identity taken back`,
      ...(opts.reason ? { reason: opts.reason } : {}),
    });
    return { person: id, name: nameEid(p), ...(confirm ? { confirmed: day.slice(0, 10) } : {}) };
  });
}
