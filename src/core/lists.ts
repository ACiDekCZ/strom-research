// A list of people the Strom app sends material to (spec 137 K2.2, K2.4; feature media.list).
//
// The app puts the list first (PUT <token>/lists/<id>: its name, kind, the rule as it says it, the IDs of its people as
// they are now) and names it with each file (X-Strom-List-Ref). The bridge keeps it in .strom/lists/<id>.json until a
// file names it (a later PUT of the same id replaces it); the strom that takes the file writes the list as it was sent
// into the research, unchanged from then on (notes/lists/<hash>.json, in git), and on the input (Input.list). Up to
// LIST_PEOPLE people of it are the input's people (People concerned in the brief); a longer list is only named, its
// people in the file — the agent looks them up itself.
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { UsageError } from "./errors.ts";
import type { InputList, Person } from "./model.ts";
import type { Tree } from "./tree.ts";

/** A list's mark from the app (as a batch's). */
export const LIST_ID = /^[A-Za-z0-9-]{1,64}$/;
/** Up to so many people of a list are the material's people; a longer list is named and its people are in its file. */
export const LIST_PEOPLE = 50;
/** The most people a list sent takes. */
export const LIST_MAX = 100_000;
/** The largest body of PUT /lists. */
export const LIST_BODY_MAX = 2 * 1024 * 1024;
export const LIST_KINDS = ["fixed", "auto", "work"] as const;

/** A list as the app sent it (kept by the bridge until a file names it). */
export interface SentList {
  id: string;
  name: string;
  kind?: (typeof LIST_KINDS)[number];
  /** The rule of an automatic list, as the app says it. */
  rule?: string;
  /** The rule as the app keeps it, unchanged (only kept). */
  ruleData?: unknown;
  persons: string[];
  /** People of the list the research has not got (no REFN): only how many. */
  missing?: number;
  /** When the app sent it. */
  at: string;
}

const dirOf = (root: string) => path.join(root, ".strom", "lists");
const fileOf = (root: string, id: string) => path.join(dirOf(root), `${id}.json`);

/** A body of PUT /lists checked: the list, else why not (its code). */
export function checkSentList(id: string, body: unknown): SentList | { code: string; why: string } {
  const bad = (why: string) => ({ code: "list.bad-body", why });
  if (!LIST_ID.test(id)) return bad("the list's mark: letters, digits, - (at most 64)");
  if (!body || typeof body !== "object" || Array.isArray(body)) return bad("the body: JSON {name, kind, rule?, persons: [P…], missing?, at?}");
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.normalize("NFC").replace(/[\p{Cc}]/gu, " ").trim().slice(0, 200) : "";
  if (!name) return bad("name: the list's name");
  if (b.kind !== undefined && !(LIST_KINDS as readonly unknown[]).includes(b.kind)) return bad(`kind: ${LIST_KINDS.join(" | ")}`);
  if (b.rule !== undefined && typeof b.rule !== "string") return bad("rule: the rule as the app says it (text)");
  if (!Array.isArray(b.persons)) return bad("persons: [P…], the IDs of its people in the research");
  if (b.persons.length > LIST_MAX) return { code: "list.large", why: `at most ${LIST_MAX} people in a list` };
  const persons: string[] = [];
  for (const p of b.persons) {
    const id = typeof p === "string" ? p.trim().toUpperCase() : "";
    if (!/^P\d{1,9}$/.test(id)) return bad("persons: [P…], the IDs of its people in the research");
    if (!persons.includes(id)) persons.push(id);
  }
  if (b.missing !== undefined && !(Number.isInteger(b.missing) && (b.missing as number) >= 0)) return bad("missing: how many people of the list the research has not got");
  const at = typeof b.at === "string" && !Number.isNaN(Date.parse(b.at)) ? new Date(b.at).toISOString() : new Date().toISOString();
  const rule = typeof b.rule === "string" ? b.rule.normalize("NFC").replace(/[\p{Cc}]/gu, " ").trim().slice(0, 500) : "";
  return {
    id,
    name,
    ...(b.kind ? { kind: b.kind as SentList["kind"] } : {}),
    ...(rule ? { rule } : {}),
    ...(b.ruleData !== undefined ? { ruleData: b.ruleData } : {}),
    persons,
    ...(b.missing ? { missing: b.missing as number } : {}),
    at,
  };
}

/** Kept by the bridge until a file names it (written whole or not at all). */
export function keepSentList(root: string, l: SentList): void {
  fs.mkdirSync(dirOf(root), { recursive: true });
  const f = fileOf(root, l.id);
  fs.writeFileSync(`${f}.${process.pid}.tmp`, JSON.stringify(l));
  fs.renameSync(`${f}.${process.pid}.tmp`, f);
}

export function readSentList(root: string, id: string): SentList | undefined {
  if (!LIST_ID.test(id)) return undefined;
  try {
    const l = JSON.parse(fs.readFileSync(fileOf(root, id), "utf8")) as SentList;
    return l && l.id === id && Array.isArray(l.persons) ? l : undefined;
  } catch {
    return undefined;
  }
}

/** The person by ID through merges, if the research has them. */
function personHere(tree: Tree, id: string): string | undefined {
  let p = tree.get<Person>(id);
  for (let hops = 0; p?.mergedInto && hops < 10; hops++) p = tree.get<Person>(p.mergedInto);
  return p && p.type === "person" && !p.retracted ? p.id : undefined;
}

/**
 * The list a file names, written into the research as it was sent (notes/lists/<hash>.json, the same content one file):
 * what the input keeps of it, and its people who are the material's people (all of a list of up to LIST_PEOPLE, else
 * none — the list is named). An ID the research has not got counts as missing. The caller holds the tree lock.
 */
export function takeList(tree: Tree, id: string): { list: InputList; persons: string[] } {
  const sent = readSentList(tree.root, id);
  if (!sent) throw new UsageError(`no list ${id} sent to this research`, { hint: "the app sends the list first (PUT lists/<id>), then its files", code: "media.no-list", params: { list: id } });
  const persons: string[] = [];
  for (const p of sent.persons) {
    const here = personHere(tree, p);
    if (here && !persons.includes(here)) persons.push(here);
  }
  const missing = (sent.missing ?? 0) + sent.persons.filter((p) => !personHere(tree, p)).length;
  const kept = { id: sent.id, name: sent.name, ...(sent.kind ? { kind: sent.kind } : {}), ...(sent.rule ? { rule: sent.rule } : {}), ...(sent.ruleData !== undefined ? { ruleData: sent.ruleData } : {}), at: sent.at, ...(missing ? { missing } : {}), persons };
  const text = JSON.stringify(kept, null, 1) + "\n";
  const rel = `notes/lists/${crypto.createHash("sha256").update(text).digest("hex").slice(0, 16)}.json`;
  // a logged, sealed write (committed in an archive too, where notes/ is the person's own and never swept in)
  if (!fs.existsSync(path.join(tree.root, ...rel.split("/")))) tree.putFile(rel, text, { op: "list.keep", targets: [], summary: `the list "${sent.name.slice(0, 50)}" (${persons.length} people) the Strom app sent material to` });
  const list: InputList = { id: sent.id, name: sent.name, ...(sent.kind ? { kind: sent.kind } : {}), ...(sent.rule ? { rule: sent.rule } : {}), count: persons.length, ...(missing ? { missing } : {}), at: sent.at, file: rel };
  return { list, persons: persons.length <= LIST_PEOPLE ? persons : [] };
}

/** The same list (the same people as sent then): sent again it changes nothing. */
export const sameList = (a: InputList | undefined, b: InputList): boolean => !!a && a.file === b.file && a.id === b.id;
