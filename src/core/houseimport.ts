// A research of a house the person made themselves, taken in (strom house import, spec 030 K8.1–K8.5): each text file
// is kept as it came, as material of the houses it is of (Input kind text, ownResearch, houses [A…]); the links it went
// through are written into each house as gone through (passed, origin import) — never searched again by a later task —
// and those of a section it says are to be gone through by hand or only in a reading room as manual (assets/terms/
// houses.json); a task of taking it over waits for the agent (origin house:import:<A…>, level intake), which writes
// what it says into the house without searching anew.
//
// Which house a file is of is read from its first heading and its name (core/streets.ts houseInTitle): its
// municipality matched to one place record, each number to a house of it. Never guessed: what is not clear is a
// question — asked at a terminal, else the whole import is refused before anything is written with the exact command
// that says it (--house <file>=<house>, --skip <file>). A file of no house is not taken, and the import says so; a
// folder's images and map data in its subfolders and a web page beside it are not taken either, only listed in the task.

import fs from "node:fs";
import path from "node:path";
import { StromError, EXIT, UsageError } from "./errors.ts";
import { fileSha256, mimeOf } from "./media.ts";
import type { House, HouseManual, HousePassed, Input, Place, Task } from "./model.ts";
import { phrase } from "./phrases.ts";
import { create, update } from "./records.ts";
import { appHouseKey, appPlaceKey, houseInTitle } from "./streets.ts";
import { decodeText, foldText, safeFolderName } from "./text.ts";
import { readAsset } from "./assets.ts";
import { now, type Tree } from "./tree.ts";
import { addHouse, findHouse, houseImportOrigin, houseIndex, houseRows, recordOf, type HouseRow } from "./houses.ts";

/** What is taken as a research: text files. */
export const IMPORT_EXT = new Set([".md", ".markdown", ".txt"]);
/** Web pages beside it (a map made for it): not taken, said. */
const PAGE_EXT = new Set([".html", ".htm"]);

// ── reading a research ──────────────────────────────────────────────────────────────────────────────────────────

let manualWords: string[] | undefined;
/** The words of a heading of a section to go through by hand (assets/terms/houses.json manual), folded. */
function manualTerms(): string[] {
  if (manualWords) return manualWords;
  try {
    const f = JSON.parse(readAsset("terms", "houses.json") ?? "{}") as { manual?: Record<string, string[]> };
    manualWords = Object.values(f.manual ?? {}).flat().map((w) => foldText(w));
  } catch {
    manualWords = [];
  }
  return manualWords;
}

/** A heading of a section whose links are to be gone through by hand. */
export function manualHeading(heading: string): boolean {
  const h = foldText(heading);
  const words = h.split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
  return manualTerms().some((t) => (t.includes(" ") ? h.includes(t) : words.some((w) => w.startsWith(t))));
}

/** A link of a research: its words, its address, the section it stands in. */
export interface ResearchLink {
  what: string;
  url: string;
  manual: boolean;
  section?: string;
}

/** What a research's text says of itself: its first heading, its day, its links by section. */
export interface ResearchText {
  title?: string;
  date?: string;
  links: ResearchLink[];
}

const LINK = /\[([^\]]*)\]\((https?:\/\/[^\s)]+(?:\([^\s)]*\))?[^\s)]*)\)|<(https?:\/\/[^>\s]+)>|(https?:\/\/[^\s<>()\]|]+)/giu;

/** A day as a research writes it ("26. 11. 2026", "2026-11-26") in ISO; else undefined. */
function dayOf(text: string): string | undefined {
  const iso = /(\d{4})-(\d{1,2})-(\d{1,2})/u.exec(text);
  if (iso) return `${iso[1]}-${iso[2]!.padStart(2, "0")}-${iso[3]!.padStart(2, "0")}`;
  const dmy = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/u.exec(text);
  if (dmy) return `${dmy[3]}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
  return undefined;
}

/** Read a research's text: its first heading, the day it gives, its links and whether their section is manual. */
export function readResearch(text: string): ResearchText {
  const out: ResearchText = { links: [] };
  const stack: { level: number; text: string }[] = [];
  for (const raw of text.normalize("NFC").split(/\r?\n/u)) {
    const line = raw.trim();
    const h = /^(#{1,6})\s+(.+?)\s*#*$/u.exec(line);
    if (h) {
      const level = h[1]!.length;
      if (out.title === undefined && level === 1) out.title = h[2]!.trim();
      while (stack.length && stack.at(-1)!.level >= level) stack.pop();
      stack.push({ level, text: h[2]!.trim() });
      continue;
    }
    if (out.date === undefined) {
      const d = /^(?:\*\*)?(?:datum|date|stand|data|dne)(?:\*\*)?\s*:\s*(?:\*\*)?\s*(.+)$/iu.exec(line);
      if (d) out.date = dayOf(d[1]!);
    }
    const manual = stack.some((s) => manualHeading(s.text));
    const section = stack.filter((s) => s.level > 1).at(-1)?.text;
    // a line's own words, its links taken out: what a bare address or a link of no words was for
    const context = line.replace(LINK, (_m, words: string | undefined) => words ?? "").replace(/[|*_`>#]+/gu, " ").replace(/^[-+\d.\s]+/u, "").replace(/\s+/gu, " ").trim();
    for (const m of line.matchAll(LINK)) {
      const url = (m[2] ?? m[3] ?? m[4] ?? "").replace(/[.,;:]+$/u, "");
      if (!url) continue;
      const words = (m[1] ?? "").replace(/[*_`]+/gu, "").trim();
      // a row of a table: its other cells (the year, what happened, how sure) say what the address was for
      const cells = line.startsWith("|") ? line.split("|").map((c) => c.trim()).filter((c) => c && !/^:?-+:?$/u.test(c) && !c.includes(url)) : [];
      const what = (words && words !== url ? words : cells.length ? cells.join(" · ") : context || url).slice(0, 1000);
      out.links.push({ what, url, manual, ...(section ? { section } : {}) });
    }
  }
  if (out.title === undefined) {
    const first = text.split(/\r?\n/u).find((l) => /^#{1,6}\s+\S/u.test(l.trim()));
    if (first) out.title = first.trim().replace(/^#{1,6}\s+/u, "").trim();
  }
  return out;
}

// ── which house a file is of ────────────────────────────────────────────────────────────────────────────────────

/** A house a file is to be taken for: a row of the research, or a house to make (the person said so). */
export type ImportTarget = { row: HouseRow } | { make: { place: Place; house: string } };

/** A file a research is in, read and assigned. */
export interface ImportFile {
  file: string;
  name: string;
  text: string;
  sha: string;
  research: ResearchText;
  targets: ImportTarget[];
}

/** What could not be decided of a file: a question to the person. */
export interface ImportQuestion {
  file: string;
  name: string;
  why: "town-unknown" | "town-ambiguous" | "house-unknown" | "town-not-a-place";
  /** What the file says: its municipality and number. */
  town: string;
  number?: string;
  /** The houses it may be (A… or key) and what to make: what the person picks from. */
  candidates: { house: string; label: string; make?: { place: string; house: string } }[];
  /** The command that says it. */
  set: string;
}

export interface ImportPlan {
  files: ImportFile[];
  /** Files not taken, and why: a web page, another kind of file, of no house, skipped, taken already. */
  skipped: { file: string; name: string; why: "page" | "other" | "no-house" | "skip" | "known"; input?: string }[];
  /** The files of a folder's subfolders: never taken, listed for the agent. */
  left: string[];
  questions: ImportQuestion[];
}

const shellArg = (s: string) => (/^[\p{L}\p{M}\p{N}_./:=|-]+$/u.test(s) ? s : `"${s.replace(/(["\\$`])/gu, "\\$1")}"`);

/** A house typed with --house: A…, a key, "<L…|municipality> <number>" — one to make where it is none yet. */
function targetOf(tree: Tree, rows: HouseRow[], ref: string): ImportTarget {
  try {
    return { row: findHouse(tree, ref, rows) };
  } catch (err) {
    if (!(err instanceof UsageError) || err.code !== "house.unknown" || /^[Aa]\d+$/u.test(ref.trim()) || ref.includes("|")) throw err;
  }
  const words = ref.normalize("NFC").trim().split(/\s+/u);
  for (let cut = words.length - 1; cut >= 1; cut--) {
    const town = words.slice(0, cut).join(" ");
    const places = placesNamed(tree, town);
    if (places.length === 1) return { make: { place: places[0]!, house: words.slice(cut).join(" ") } };
    if (places.length > 1) throw new UsageError(`"${town}" is more places: ${places.map((p) => p.id).join(", ")} — name it by its ID`, { code: "house.town" });
  }
  throw new UsageError(`no house "${ref}", and no place of its municipality to make it in`, { code: "house.unknown", hint: "strom house list — or strom place add <municipality>" });
}

function placesNamed(tree: Tree, town: string): Place[] {
  if (/^[Ll]\d+$/u.test(town.trim())) {
    const p = tree.get<Place>(`L${town.trim().slice(1).padStart(4, "0")}`);
    return p && !p.retracted ? [p] : [];
  }
  const ft = foldText(town);
  return tree.list<Place>("place").filter((p) => !p.retracted && p.names.some((n) => foldText(n.name) === ft));
}

/** Is the file the one a --house or --skip names: its name, or its path. */
function names(file: string, given: string): boolean {
  return path.basename(file) === given.normalize("NFC") || path.basename(file).normalize("NFC") === given.normalize("NFC") || path.resolve(file) === path.resolve(given);
}

/**
 * Read the files and folders given and decide each file's houses: what is clear, what is a question. `assign`: the
 * person's --house <file>=<house>; `skip`: --skip <file>. Nothing is written.
 */
export function planImport(tree: Tree, paths: string[], opts: { assign?: { file: string; house: string }[]; skip?: string[] } = {}): ImportPlan {
  const plan: ImportPlan = { files: [], skipped: [], left: [], questions: [] };
  const index = houseIndex(tree);
  const rows = houseRows(tree, { index });
  const known = new Map(tree.list<Input>("input").filter((i) => i.sha && i.retracted?.reason !== "deleted").map((i) => [i.sha!, i]));
  const files: string[] = [];
  for (const p of paths) {
    const st = fs.statSync(p);
    if (!st.isDirectory()) {
      files.push(p);
      continue;
    }
    for (const e of fs.readdirSync(p, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name.startsWith(".") || e.name === "Thumbs.db" || e.name === "desktop.ini") continue;
      const full = path.join(p, e.name);
      if (e.isDirectory()) {
        const walk = (d: string): void => {
          for (const x of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            if (x.name.startsWith(".")) continue;
            if (x.isDirectory()) walk(path.join(d, x.name));
            else plan.left.push(path.relative(p, path.join(d, x.name)).split(path.sep).join("/"));
          }
        };
        walk(full);
      } else if (e.isFile()) files.push(full);
    }
  }
  for (const file of files) {
    const name = path.basename(file).normalize("NFC");
    const ext = path.extname(file).toLowerCase();
    if ((opts.skip ?? []).some((s) => names(file, s))) {
      plan.skipped.push({ file, name, why: "skip" });
      continue;
    }
    if (PAGE_EXT.has(ext)) {
      plan.skipped.push({ file, name, why: "page" });
      plan.left.push(name);
      continue;
    }
    if (!IMPORT_EXT.has(ext)) {
      plan.skipped.push({ file, name, why: "other" });
      plan.left.push(name);
      continue;
    }
    const text = decodeText(fs.readFileSync(file));
    const sha = fileSha256(file);
    const research = readResearch(text);
    const said = (opts.assign ?? []).filter((a) => names(file, a.file));
    const had = known.get(sha);
    const add = (targets: ImportTarget[]) => plan.files.push({ file, name, text, sha, research, targets });
    if (said.length) {
      add(said.map((a) => targetOf(tree, rows, a.house)));
      continue;
    }
    // taken before as it is: nothing again (its houses kept)
    if (had?.houses?.length) {
      plan.skipped.push({ file, name, why: "known", input: had.id });
      continue;
    }
    const found = (research.title ? houseInTitle(research.title) : undefined) ?? houseInTitle(path.basename(file, path.extname(file)));
    if (!found) {
      plan.skipped.push({ file, name, why: "no-house" });
      continue;
    }
    const ask = (q: Omit<ImportQuestion, "file" | "name" | "set">, set: string) => plan.questions.push({ file, name, ...q, set });
    const cmd = (house: string) => `strom house import ${shellArg(file)} --house ${shellArg(`${name}=${house}`)}`;
    const places = placesNamed(tree, found.town);
    if (places.length === 0) {
      // the facts write it, but no place record is of it: a house of it has no record to be
      const inTree = rows.filter((r) => !r.place.id && r.place.key === appPlaceKey(found.town));
      ask({ why: inTree.length ? "town-not-a-place" : "town-unknown", town: found.town, candidates: [] }, `strom place add ${shellArg(found.town)} — then ${cmd(`<L…> ${found.numbers[0]}`)}`);
      continue;
    }
    const targets: ImportTarget[] = [];
    let open = false;
    for (const number of found.numbers) {
      const hk = appHouseKey(number);
      const matches = rows.filter((r) => !!r.place.id && places.some((p) => p.id === r.place.id) && (appHouseKey(r.house) === hk || r.key.split("|")[1] === hk));
      if (places.length === 1 && matches.length === 1) {
        targets.push({ row: matches[0]! });
        continue;
      }
      open = true;
      const label = (r: HouseRow) => `${r.id ?? r.key} ${r.place.name} ${r.house}${r.name ? ` (${r.name})` : ""}${r.persons ? ` · ${r.persons}` : ""}`;
      const candidates = [
        ...matches.map((r) => ({ house: r.id ?? r.key, label: label(r) })),
        ...places.filter((p) => !matches.some((r) => r.place.id === p.id)).map((p) => ({ house: `${p.id} ${number}`, label: `${p.id} ${p.names[0]?.name ?? ""} ${number}`, make: { place: p.id, house: number } })),
      ];
      ask({ why: places.length > 1 ? "town-ambiguous" : "house-unknown", town: found.town, number, candidates }, candidates.map((c) => cmd(c.house)).join(" | "));
    }
    if (!open) add(targets);
  }
  return plan;
}

/** The import refused for its questions (no terminal to ask): exit 3, each question with the command that says it. */
export class ImportQuestions extends StromError {
  readonly questions: ImportQuestion[];
  constructor(questions: ImportQuestion[]) {
    super(`which house ${questions.length === 1 ? "a file is" : `${questions.length} files are`} of is not clear: nothing was taken`, {
      exitCode: EXIT.needsInput,
      code: "house.import.ask",
      hint: [...new Set(questions.map((q) => q.set))].join("\n"),
      details: { questions },
    });
    this.name = "ImportQuestions";
    this.questions = questions;
  }
  override toJSON(): Record<string, unknown> {
    return { status: "needs-input", message: this.message, code: this.code, questions: this.questions };
  }
}

// ── writing it ──────────────────────────────────────────────────────────────────────────────────────────────────

/** What one file came to: its material, its houses, what of its links each house got. */
export interface ImportDone {
  file: string;
  input: string;
  houses: { id: string; passed: number; manual: number; task?: string }[];
}

/** Take the files of a plan in: each a material of its houses, its links gone through or manual, a takeover task each. */
export function writeImport(tree: Tree, plan: ImportPlan, from: (file: string) => string): ImportDone[] {
  const done: ImportDone[] = [];
  const day = now().slice(0, 10);
  tree.withTreeLock(() => {
    for (const f of plan.files) {
      const houses: House[] = [];
      for (const t of f.targets) {
        const h = "row" in t ? recordOf(tree, t.row) : addHouse(tree, t.make.place, t.make.house, { byUser: true });
        if (!houses.some((x) => x.id === h.id)) houses.push(h);
      }
      const ids = houses.map((h) => h.id);
      // the same text taken before: its houses added to it, nothing twice
      const had = tree.list<Input>("input").find((i) => i.sha === f.sha && i.retracted?.reason !== "deleted");
      let input: Input;
      if (had) {
        const more = ids.filter((id) => !(had.houses ?? []).includes(id));
        input = more.length
          ? update<Input>(tree, had.id, "input", (i) => ({ ...i, houses: [...(i.houses ?? []), ...more], ownResearch: true }), { op: "input.houses", summary: `${had.id} of ${more.join(", ")}` })
          : had;
      } else {
        const id = tree.peekId("I");
        const rel = `inputs/${id}-${safeFolderName(f.name)}`;
        if (!tree.dryRun) {
          tree.remember(path.join(tree.root, rel));
          fs.copyFileSync(f.file, path.join(tree.root, rel));
        }
        const title = f.research.title?.slice(0, 300);
        input = create<Input>(
          tree,
          "input",
          {
            name: f.name,
            file: rel,
            sha: f.sha,
            size: fs.statSync(f.file).size,
            mime: mimeOf(f.file),
            from: from(f.file),
            kind: "text",
            state: "new",
            houses: ids,
            ownResearch: true,
            ...(title ? { title, titled: { by: "user" as const, at: now() } } : {}),
          },
          (iid) => `+${iid} input text "${f.name.slice(0, 50)}" of ${ids.join(", ")}`,
        );
      }
      const at = f.research.date ?? day;
      const manualUrls = new Set(f.research.links.filter((l) => l.manual).map((l) => l.url));
      const record: ImportDone = { file: f.file, input: input.id, houses: [] };
      for (const h of houses) {
        const cur = tree.get<House>(h.id)!;
        const seen = new Set([...cur.passed.map((p) => p.url), ...cur.manual.map((m) => m.url)].filter(Boolean));
        const passed: HousePassed[] = [];
        const manual: HouseManual[] = [];
        const n = { p: maxOf(cur.passed, "p"), o: maxOf(cur.manual, "o") };
        for (const l of f.research.links) {
          if (seen.has(l.url)) continue;
          seen.add(l.url);
          if (manualUrls.has(l.url)) manual.push({ id: `o${++n.o}`, origin: "import", at, what: l.what, url: l.url, ...(l.section ? { why: l.section.slice(0, 500) } : {}) });
          else passed.push({ id: `p${++n.p}`, origin: "import", at, what: l.what, url: l.url });
        }
        if (passed.length || manual.length)
          update<House>(tree, h.id, "house", (x) => ({ ...x, passed: [...x.passed, ...passed], manual: [...x.manual, ...manual] }), {
            op: "house.import",
            summary: `${h.id} +${passed.length} gone through, +${manual.length} by hand (${input.id})`,
            targets: [input.id],
          });
        record.houses.push({ id: h.id, passed: passed.length, manual: manual.length, ...takeover(tree, h, input, plan.left) });
      }
      done.push(record);
    }
  });
  return done;
}

function maxOf(list: { id: string }[], letter: string): number {
  let max = 0;
  for (const x of list) {
    const m = new RegExp(`^${letter}(\\d+)$`, "u").exec(x.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

/** The task of taking a research over for a house: one while one is not finished (the material added to it). */
function takeover(tree: Tree, h: House, input: Input, left: string[]): { task?: string } {
  const origin = houseImportOrigin(h.id);
  const live = tree.list<Task>("task").find((t) => t.origin === origin && !t.retracted && ["open", "doing", "waiting", "parked"].includes(t.state));
  if (live) {
    if (live.where.includes(input.id)) return { task: live.id };
    update<Task>(tree, live.id, "task", (t) => ({ ...t, where: [...t.where, input.id], subject: [...new Set([...t.subject, input.id])] }), { op: "task.edit", summary: `${live.id} +${input.id}` });
    return { task: live.id };
  }
  const lang = tree.lang;
  const place = tree.get<Place>(h.place)?.names[0]?.name ?? h.place;
  const house = `${place} ${h.house}${h.name ? ` (${h.name})` : ""}`;
  const list = left.slice(0, 20).join(", ") + (left.length > 20 ? ", …" : "");
  const what = phrase(lang, "house.takeover", { house, id: input.id }).slice(0, 200);
  const t = create<Task>(
    tree,
    "task",
    {
      level: "intake",
      priority: 4,
      what,
      where: [input.id],
      why: (phrase(lang, "house.takeover.why", { id: h.id }) + (left.length ? ` ${phrase(lang, "house.takeover.left", { list })}` : "")).slice(0, 1000),
      doneWhen: phrase(lang, "house.takeover.done", { id: h.id, input: input.id }),
      subject: [h.id, input.id],
      state: "open",
      origin,
    },
    (id) => `+${id} task "${what.slice(0, 60)}"`,
  );
  return { task: t.id };
}
