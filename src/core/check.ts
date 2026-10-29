// `strom check` — does the evidence hold together? Findings are either
// errors (block the automatic commit) or warnings.

import { streetPlaces } from "./streetfix.ts";
import fs from "node:fs";
import path from "node:path";
import { RECORD_TYPES, type Conflict, type Family, type Input, type Media, type Person, type RecordType } from "./model.ts";
import { Settings } from "./config.ts";
import { recordRefs, validateRecord } from "./validate.ts";
import { readJson, readJsonIfExists } from "./json.ts";
import { Tree, prefixOf } from "./tree.ts";
import { isBirthFamily, ownAncestors } from "./people.ts";
import { afterDeath, afterDeathMessage } from "./afterdeath.ts";
import { longNames, NAME_WORDS_MAX } from "./participants.ts";

export interface Finding {
  level: "error" | "warn";
  code: string;
  message: string;
  id?: string;
  file?: string;
  hint?: string;
  /** How many it stands for, where one finding says them all (files only in iCloud, files of the shared folder missing). */
  count?: number;  /** What a person reads of it in their language (after-death: the person, the event, the death). */
  params?: Record<string, string>;
}

export function check(tree: Tree): Finding[] {
  const out: Finding[] = [];
  const seen = new Map<string, string>();

  // 1. every file parses, is valid, and its name matches its ID
  for (const [type, def] of Object.entries(RECORD_TYPES) as [RecordType, (typeof RECORD_TYPES)[RecordType]][]) {
    const dir = path.join(tree.dataDir, def.dir);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) {
      if (!f.endsWith(".json")) continue;
      const file = tree.relative(path.join(dir, f));
      let rec: { id?: string; type?: string };
      try {
        rec = readJson(path.join(dir, f));
      } catch (err) {
        out.push({ level: "error", code: "json", file, message: (err as Error).message });
        continue;
      }
      if (rec.id !== f.slice(0, -5)) out.push({ level: "error", code: "file-name", file, message: `file name does not match id ${rec.id}` });
      if (rec.type !== type) out.push({ level: "error", code: "wrong-dir", file, message: `record of type ${rec.type} in ${def.dir}/` });
      for (const p of validateRecord(rec)) out.push({ level: "error", code: "schema", id: rec.id, file, message: `${p.path} ${p.message}` });
      if (rec.id) {
        if (seen.has(rec.id)) out.push({ level: "error", code: "duplicate-id", id: rec.id, message: `also in ${seen.get(rec.id)}` });
        seen.set(rec.id, file);
      }
    }
  }

  // 2. references point to existing records
  const persons = tree.list<Person>("person");
  const families = tree.list<Family>("family");
  for (const type of Object.keys(RECORD_TYPES) as RecordType[])
    for (const rec of tree.list(type))
      for (const ref of recordRefs(rec))
        if (!tree.get(ref.id)) out.push({ level: "error", code: "dangling", id: rec.id, message: `${ref.path} → ${ref.id} does not exist` });

  // 3. a child belongs to at most one birth family
  const birthFamily = new Map<string, string>();
  for (const f of families.filter((x) => !x.retracted))
    for (const c of f.children) {
      if (!isBirthFamily(f, c.person)) continue;
      const prev = birthFamily.get(c.person);
      if (prev) out.push({ level: "error", code: "two-birth-families", id: c.person, message: `child of both ${prev} and ${f.id}` });
      else birthFamily.set(c.person, f.id);
    }

  // 3b. nobody is their own ancestor (a merge or a link that closed a circle)
  for (const circle of ownAncestors(tree))
    out.push({
      level: "error",
      code: "own-ancestor",
      id: circle[0],
      message: circle.length === 1 ? `${circle[0]} is their own parent` : `their own ancestors: ${circle.join(" → ")} → ${circle[0]} (each a child of the next)`,
      hint: `take out the link made by mistake: strom family edit <F…> --remove <who> --reason "…"`,
    });

  // 4. event IDs are unique across the tree
  const eventOwner = new Map<string, string>();
  for (const r of [...persons, ...families])
    for (const e of r.events) {
      const prev = eventOwner.get(e.id);
      if (prev) out.push({ level: "error", code: "duplicate-id", id: e.id, message: `event in both ${prev} and ${r.id}` });
      eventOwner.set(e.id, r.id);
    }

  // 5. a proven fact beside an open conflict about the same person: the proof is not finished (GPS)
  for (const x of tree.list<Conflict>("conflict").filter((c) => c.state === "open"))
    for (const id of x.subject) {
      const p = tree.get<Person>(id);
      if (p?.type === "person" && p.events.some((e) => e.status === "proven" && !e.retracted))
        out.push({ level: "warn", code: "open-conflict", id: x.id, message: `open while ${id} has proven facts — resolve it: strom conflict resolve ${x.id} --resolution … --reasoning …` });
    }

  // 5b. a house number written into the place: the place stops matching its books and its other facts
  for (const owner of [...persons, ...families])
    for (const e of owner.events) {
      const m = e.place && !e.retracted ? houseIn(e.place) : undefined;
      if (m)
        out.push({
          level: "warn",
          code: "house-in-place",
          id: e.id,
          message: `place "${e.place}" holds a house number`,
          hint: `strom event edit ${e.id} --place "${m.place}" --house ${m.house} --reason "the house number out of the place"`,
        });
    }

  // 5c. a person named alive after their death (an event or a marriage certainly after it), unless the person marked
  // it no error — a warning to look into, never blocking
  for (const a of afterDeath(tree))
    out.push({
      level: "warn",
      code: "after-death",
      id: a.event.id,
      message: afterDeathMessage(a),
      hint: `strom person show ${a.person}`,
      params: { person: a.person, kind: a.kind, event: a.event.kind, date: a.event.date ?? "", death: a.death.date ?? "", year: a.year },
    });

  // 5d. a participant's name that holds what the record says beside it (written before strom refused it): one warning,
  // how many — strom fixes sets them apart, as the person decides
  const long = longNames(tree);
  if (long.count)
    out.push({
      level: "warn",
      code: "participant-long-name",
      id: long.first,
      count: long.count,
      message: `${long.count} participant name${long.count === 1 ? "" : "s"} hold${long.count === 1 ? "s" : ""} more than a name (more than ${NAME_WORDS_MAX} words, or a number)`,
      hint: "strom fixes show participant-names",
    });

  // 5e. a fact whose place holds a street or a house number (written before strom refused it): one warning, how many —
  // strom fixes sets them right, as the person decides
  const streets = streetPlaces(tree);
  if (streets.count)
    out.push({
      level: "warn",
      code: "street-place",
      id: streets.first,
      count: streets.count,
      message: `${streets.count} fact${streets.count === 1 ? "" : "s"} hold${streets.count === 1 ? "s" : ""} a street or a house number in the place (the place is the municipality, the street and the number the house)`,
      hint: "strom fixes show street-places",
    });

  // 6. counters are ahead of every ID on disk
  const counters = readJsonIfExists<Record<string, number>>(path.join(tree.dataDir, "_counters.json")) ?? {};
  for (const id of [...seen.keys(), ...eventOwner.keys()]) {
    const prefix = prefixOf(id);
    if (!prefix) continue;
    if ((counters[prefix] ?? 0) < Number(id.slice(1)))
      out.push({ level: "warn", code: "counter", id, message: `counter ${prefix} is behind existing IDs (it self-heals on next write)` });
  }

  return out;
}

export function hasErrors(findings: Finding[]): boolean {
  return findings.some((f) => f.level === "error");
}

/** "Vavřinec čp. 13", "Týnec, Haus-Nr. 5", "Oakham No. 12" → the settlement and the house. */
export function houseIn(place: string): { place: string; house: string } | undefined {
  const m = /^(.*?)[\s,]+(?:č\.\s?p\.?|čp\.?|č\.\s?d\.?|c\.\s?p\.?|cp\.|Haus-?\s?N(?:r|ro)\.?|Nr\.|No\.|house\s+(?:No\.?)?|dům\s+(?:č\.)?)\s*(\d+[\w/-]*)\s*$/iu.exec(place.trim());
  if (!m || !m[1]!.trim()) return undefined;
  return { place: m[1]!.trim().replace(/,$/, ""), house: m[2]! };
}

export const SHARED_MISSING = "shared-missing";

/**
 * The family's material and the images nobody can fetch again whose file in the shared folder is not on this computer
 * (found in the audit: the research's folder brought back from a backup without the shared one — check said "nothing
 * lost"): one warning, how many and the first, the way back. The records are whole (a warning, no error); only whether
 * each file is there is asked — never read. The images an archive gives again (fetched) are not counted: strom fetch
 * puts them back.
 */
export function sharedMissing(tree: Tree): Finding[] {
  const shared = new Settings(tree.env, {}).shared()?.value;
  const there = (rel: string) => shared !== undefined && fs.existsSync(path.join(shared, rel));
  const gone: string[] = [];
  for (const i of tree.list<Input>("input")) if (i.file?.startsWith("media:") && !there(i.file.slice(6))) gone.push(i.id);
  for (const m of tree.list<Media>("media")) if (!m.retracted && !m.fetched && m.file && !there(m.file)) gone.push(m.id);
  if (!gone.length) return [];
  const first = gone[0]!;
  return [
    {
      level: "warn",
      code: SHARED_MISSING,
      id: first,
      count: gone.length,
      message: `${gone.length} ${gone.length === 1 ? "file" : "files"} of the shared folder not on this computer (the first: ${first}) — the family's material and images strom keeps beside the research, not in its folder`,
      hint: `bring the shared folder back from a backup of the whole Strom folder (its subfolder shared); where the first belongs: strom ${first.startsWith("I") ? "input" : "media"} show ${first}`,
    },
  ];
}
