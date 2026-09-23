// `strom check` — does the evidence hold together? Findings are either
// errors (block the automatic commit) or warnings.

import fs from "node:fs";
import path from "node:path";
import { RECORD_TYPES, type Conflict, type Family, type Person, type RecordType } from "./model.ts";
import { recordRefs, validateRecord } from "./validate.ts";
import { readJson, readJsonIfExists } from "./json.ts";
import { Tree, prefixOf } from "./tree.ts";
import { isBirthFamily } from "./people.ts";

export interface Finding {
  level: "error" | "warn";
  code: string;
  message: string;
  id?: string;
  file?: string;
  hint?: string;
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
