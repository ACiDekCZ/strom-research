// intake · input list · show · skip · done — what a research starts from.
//
// Anything can be an input: a folder of scans and documents, a GEDCOM file,
// a tree exported from the Strom app, a text the user types. Inputs are the
// unchanged BASE of a research; the agent builds the working tree from them
// through tasks, and the tree it builds is exported as GEDCOM.

import fs from "node:fs";
import path from "node:path";
import { register } from "../cli/registry.ts";
import { sameFamily } from "../core/surnames.ts";
import { twoPeople } from "../core/quality.ts";
import type { Context } from "../cli/context.ts";
import { counted, lines, moreLine, paginate, table, truncate } from "../cli/format.ts";
import { readingsLine, readingsOf } from "../core/readsync.ts";
import { notFound, UsageError } from "../core/errors.ts";
import type { Input, Name, Person, Research, Task } from "../core/model.ts";
import { collectFiles, fileSha256, inputPath, MAX_IN_TREE, mimeOf, storeShared } from "../core/media.ts";
import { create, normId, requireRecord, update } from "../core/records.ts";
import { phrase } from "../core/phrases.ts";
import { addMarriedNames, importedTree, importGedcom, importStromJson, isStromJson, marriedNamesPlan, undoMarriedNames, type ImportResult } from "../core/import.ts";
import { pendingIds } from "../core/originfix.ts";
import { displayName, gedcomName, likelyDuplicates } from "../core/people.ts";
import { decodeText, safeFolderName } from "../core/text.ts";
import { decodeGedcom, decodingNote, type DecodingNote } from "../gedcom/encoding.ts";
import type { Tree } from "../core/tree.ts";
import { amendInput, checkOriginalMeta } from "../core/originals.ts";
import { batchStatus, closeBatch, listBatches, readBatch } from "../core/batches.ts";
import { HIDE_REASONS, MATERIAL_KINDS, SORT_KINDS, type Source } from "../core/model.ts";
import { assignMaterial, editMaterial, hideMaterial, MATERIAL_MOST_EDIT, MATERIAL_TITLE_MAX, materialPersons, unhideMaterial } from "../core/material.ts";
import { checkDeleteConfirm, checkRetractWith, DELETE_MOST_FILES, deleteImpacts, deleteMaterial, deleteSourceImpacts, refuseLiveSources, type DeleteImpact } from "../core/materialdelete.ts";
import { RETRACT_MOST } from "../core/sourceretract.ts";
import { wouldLine } from "./sourceretract.ts";
import { autoCommit } from "../cli/commit.ts";
import { normalizeDate } from "../core/gdate.ts";
import { actsAsArchive } from "../core/state.ts";
import { appHasTree } from "../core/live.ts";
import { isArchive } from "../core/mode.ts";
import { decodingSaid, ui } from "../cli/ui.ts";
import { fileBy, handFiles, taskForFile, taskPeople } from "../core/taskfiles.ts";
import { isAgent } from "../core/which.ts";

/** A family tree file as text: a GEDCOM by its own encoding rule (CHAR, a Windows code page), anything else as saved. */
function treeText(file: string): string {
  const bytes = fs.readFileSync(file);
  return path.extname(file).toLowerCase() === ".ged" ? decodeGedcom(bytes).text : decodeText(bytes);
}

function kindOf(file: string, text?: string): Input["kind"] {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".ged") return "tree";
  if (ext === ".json" && text) {
    try {
      if (isStromJson(JSON.parse(text))) return "tree";
    } catch {
      // not JSON: other
    }
  }
  if ([".jpg", ".jpeg", ".png", ".tif", ".tiff", ".gif", ".webp", ".heic", ".pdf"].includes(ext)) return "document";
  if ([".txt", ".md", ".rtf", ".doc", ".docx", ".odt", ".html", ".csv"].includes(ext)) return "text";
  return "other";
}

/** The input IDs given: as arguments, and from a file (--files-from, "-" = stdin), one or more a line. */
function idsGiven(ctx: Context, args: string[], opts: Record<string, unknown>): string[] {
  const from = opts["files-from"];
  let more: string[] = [];
  if (typeof from === "string") {
    const text = from === "-" ? (ctx.io.stdinText?.() ?? "") : fs.existsSync(ctx.resolvePath(from)) ? fs.readFileSync(ctx.resolvePath(from), "utf8") : undefined;
    if (text === undefined) throw notFound(from);
    more = text.split(/[\s,]+/u).filter(Boolean);
  }
  const ids = [...args, ...more];
  if (!ids.length) throw new UsageError("give the inputs (I…)", { code: "material.body", hint: "strom input list" });
  return ids;
}

/** The research the inputs are for: the one named, else the only active one. */
/** A person for the person reading, as the material names them: "Jan Novák [P0002]" (an ID the research lacks as given). */
function whoOf(tree: Tree, ids: string[]): string {
  return ids
    .map((id) => {
      const p = tree.get<Person>(id);
      return p ? `${displayName(p)} [${p.id}]` : id;
    })
    .join(", ");
}

/** The tasks' files before a write: what a task let go of is said by its files (strom input hide). */
function filesOfTasks(tree: Tree): Map<string, string[]> {
  return new Map(tree.list<Task>("task").map((t) => [t.id, t.where.filter((w) => /^I\d/u.test(w))]));
}

/**
 * What strom input assign|hide|unskip changed, in the research language (the person reads it — the menu, the Strom
 * app's bridge, an agent too): each file, each task, each batch, from what this write logged and how the records are
 * now. The history keeps its own words.
 */
function materialLines(tree: Tree, before: Map<string, string[]>, batch?: string): string[] {
  const lang = tree.lang;
  const out: string[] = [];
  for (const o of tree.written) {
    const [id, ...rest] = o.targets;
    if (o.op === "input.assign" && id) {
      const i = tree.get<Input>(id);
      const now = new Set(i ? materialPersons(tree, i) : []);
      const add = rest.filter((p) => now.has(p));
      const remove = rest.filter((p) => !now.has(p));
      if (add.length) out.push(ui(lang, "ui.input.assign.add", { id, who: whoOf(tree, add) }));
      if (remove.length) out.push(ui(lang, "ui.input.assign.remove", { id, who: whoOf(tree, remove) }));
    } else if (o.op === "batch.assign" && batch) {
      const b = readBatch(tree.root, batch);
      const now = new Set(b?.persons ?? []);
      const name = b?.name ?? batch;
      const add = o.targets.filter((p) => now.has(p));
      const remove = o.targets.filter((p) => !now.has(p));
      if (add.length) out.push(ui(lang, "ui.input.batch.add", { name, who: whoOf(tree, add) }));
      if (remove.length) out.push(ui(lang, "ui.input.batch.remove", { name, who: whoOf(tree, remove) }));
    } else if (o.op === "task.edit" && id && rest.length) out.push(ui(lang, "ui.input.task.of", { task: id, who: whoOf(tree, rest) }));
    else if (o.op === "task.edit" && id) {
      const t = tree.get<Task>(id);
      const files = (before.get(id) ?? []).filter((f) => !t?.where.includes(f));
      if (files.length) out.push(ui(lang, "ui.input.task.without", { task: id, files: files.join(", ") }));
    } else if (o.op === "task.drop" && id) out.push(ui(lang, "ui.input.task.dropped", { task: id, files: (before.get(id) ?? []).join(", ") }));
    else if (o.op === "input.hide" && id) {
      const why = tree.get<Input>(id)?.hidden?.reason;
      out.push(`${ui(lang, "ui.input.hidden", { id })}${why ? ` (${ui(lang, `ui.input.why.${why}`)})` : ""}`);
    } else if (o.op === "input.unskip" && id) out.push(ui(lang, tree.get<Input>(id)?.state === "processed" ? "ui.input.shown.processed" : "ui.input.shown.new", { id }));
    else if (o.op === "input.media" && id) out.push(ui(lang, "ui.input.restored", { id }));
    else if (o.op === "input.edit" && id) {
      const i = tree.get<Input>(id);
      const was = before.get(`edit:${id}`) ?? [];
      const parts = [
        !was.includes("title") ? "" : i?.title ? ui(lang, "ui.input.edit.title", { value: i.title }) : ui(lang, "ui.input.edit.untitled"),
        !was.includes("kind") ? "" : i?.materialKind ? ui(lang, "ui.input.edit.kind", { value: ui(lang, `ui.input.kind.${i.materialKind}`) }) : ui(lang, "ui.input.edit.nokind"),
        !was.includes("date") ? "" : i?.date ? ui(lang, "ui.input.edit.date", { value: i.date }) : ui(lang, "ui.input.edit.nodate"),
      ].filter(Boolean);
      out.push(ui(lang, "ui.input.edit.line", { id, changes: parts.join(", ") }));
    }
  }
  return out;
}

/** What deleting a file would take, in the research language (strom input delete --dry-run). */
function deleteWould(lang: string, i: DeleteImpact): string {
  const bytes = i.keptWhy === "sameAs" ? ui(lang, "ui.input.delete.bytes.sameAs", { same: (i.sameAs ?? []).join(", ") }) : i.keptWhy === "otherResearch" ? ui(lang, "ui.input.delete.bytes.otherResearch") : ui(lang, "ui.input.delete.bytes.deleted");
  return ui(lang, "ui.input.delete.would", { id: i.id, name: i.name, sources: String(i.sources.length), excerpts: String(i.excerpts), tasks: String(i.tasks.length), links: String(i.links), bytes });
}

function researchFor(tree: Tree, named: unknown): string | undefined {
  if (typeof named === "string") return requireRecord<Research>(tree, named, "research").id;
  const active = tree.list<Research>("research").filter((r) => r.state === "active");
  return active.length === 1 ? active[0]!.id : undefined;
}

function intakeTask(tree: Tree, input: Input, research: string | undefined, imported?: ImportResult, persons: string[] = []): Task {
  return groupTask(tree, [input], research, imported, undefined, persons);
}

/** One intake task for the inputs of one folder (or one file, or one text). */
function groupTask(tree: Tree, inputs: Input[], research: string | undefined, imported?: ImportResult, folder?: string, persons: string[] = []): Task {
  const input = inputs[0]!;
  const many = inputs.length > 1;
  const tree1 = input.kind === "tree" && !many;
  const lang = tree.lang;
  const what = many
    ? phrase(lang, "intake.files", { count: inputs.length, folder: folder ?? phrase(lang, "intake.the.material"), first: input.id, last: inputs.at(-1)!.id })
    : tree1
      ? phrase(lang, imported ? "intake.tree.imported" : "intake.tree.read", { id: input.id, name: input.name })
      : input.kind === "text"
        ? phrase(lang, input.text ? "intake.text" : "intake.text.file", { id: input.id, name: input.name })
        : phrase(lang, "intake.other", { id: input.id, name: input.name });
  const why = tree1
    ? imported
      ? phrase(lang, "intake.why.imported", { persons: imported.persons, matched: imported.matched ? phrase(lang, "intake.why.matched", { matched: imported.matched }) : "" })
      : phrase(lang, "intake.why.read")
    : phrase(lang, "intake.why");
  const doneWhen = tree1 ? phrase(lang, imported ? "intake.done.imported" : "intake.done.read", { id: input.id }) : phrase(lang, "intake.done");
  const ids = inputs.map((i) => i.id);
  return create<Task>(
    tree,
    "task",
    { level: "intake", priority: 4, what, where: ids, why, doneWhen, subject: [...ids, ...persons], research, state: "open", origin: tree.actor },
    (id) => `+${id} task "${truncate(what, 60)}"`,
  );
}

/** More images than this in one folder look like the scans of a book, not family documents. */
export const BOOK_OF_SCANS = 20;
export const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".tif", ".tiff", ".jp2", ".gif", ".webp", ".heic"]);

register(
  {
    path: ["intake"],
    summary: "Take in material to research from: folders, files, a family tree (GEDCOM / Strom JSON), or text",
    group: "inputs",
    tree: true,
    writes: true,
    lock: "sections",
    description:
      "Every file is registered unchanged as an input (duplicates skipped) and gets an intake task.\n" +
      `Files up to ${MAX_IN_TREE / 1024 / 1024} MB are kept in the tree (and its history); bigger ones in shared/media.\n` +
      "Family trees are imported at once — every person and fact as a lead citing that tree.\n" +
      "--answers T…: the files came for what that waiting task waits for (a reply, a document asked for): inputs of its\n" +
      "people, handed to the task, which goes back into the queue — no intake task of their own. Only that the files came\n" +
      "is written, never words as the user's (their answer in words: strom task wake T… --answer).",
    args: [{ name: "paths", description: "files or folders", variadic: true }],
    options: [
      { name: "text", type: "string", value: "<text>", description: "what the user tells you, as an input of its own" },
      { name: "no-import", type: "boolean", description: "register trees without importing them" },
      { name: "documents", type: "boolean", description: `a folder with more than ${BOOK_OF_SCANS} images really is family documents (not scans of a book)` },
      { name: "research", type: "string", value: "<G…>", description: "the research it is for (default: the only active one)" },
      { name: "person", type: "string", multiple: true, value: "<P…>", description: "the person it is of, as the user says (repeatable): its task is shown with them" },
      { name: "answers", type: "string", value: "<T…>", description: "the files came for what this waiting task waits for: handed to it, the task back in the queue (no intake task)" },
      { name: "note", type: "string", value: "<text>", description: "what the user says of the files, kept with them (a sentence)" },
    ],
    examples: [
      'strom intake ~/Downloads/rodina',
      "strom intake strom-export.json",
      'strom intake --text "Děda Jan, narozen asi 1905 v Týnci, byl mlynář"',
      "strom intake ~/Downloads/rodina/dopis.txt --research G0001",
      'strom intake ~/Downloads/reply.pdf --answers T0005 --note "the reply of the registry office"',
    ],
    run(ctx: Context, { args, opts }) {
      const tree = ctx.tree();
      if (args.length === 0 && !opts.text) throw new UsageError("give files/folders or --text");
      // files for what a waiting task waits for: the task's people, handed to it — never words as the user's
      const answers = typeof opts.answers === "string" ? opts.answers.trim() : undefined;
      if (answers !== undefined && typeof opts.text === "string")
        throw new UsageError("--answers takes files — the user's answer in words is theirs alone", { hint: `strom task wake ${answers || "T…"} --answer "…" (the user, in their terminal or strom's menu)` });
      if (answers !== undefined && !args.length) throw new UsageError("give the files that came for the task", { hint: `strom intake <file> --answers ${answers || "T…"}` });
      const forTask = answers !== undefined ? taskForFile(tree, answers) : undefined;
      const note = typeof opts.note === "string" ? opts.note.replace(/[\p{Cc}]/gu, " ").trim().slice(0, 500) || undefined : undefined;
      const research = forTask?.research ?? researchFor(tree, opts.research);
      const persons = checkOriginalMeta(tree, { persons: [...(forTask ? taskPeople(tree, forTask) : []), ...(Array.isArray(opts.person) ? opts.person : opts.person ? [opts.person] : []).map((p) => String(p).trim().toUpperCase())] }).persons;
      // where nobody researches (an archive, a research waiting for its agent): said to the person, in the research's
      // language — kept, no task to take next (an archive's waits put aside until research is switched on)
      const quiet = actsAsArchive(tree);
      // Files per argument: a folder becomes one intake task, not one per file.
      const groups = args.map((a) => {
        const p = ctx.resolvePath(a);
        if (!fs.existsSync(p)) throw notFound(a);
        const folder = fs.statSync(p).isDirectory();
        const files = collectFiles([p]);
        const images = files.filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase())).length;
        if (folder && images > BOOK_OF_SCANS && !opts.documents)
          throw new UsageError(`${images} images in ${ctx.display(p)} look like the scans of a book, not family documents`, {
            // where nobody researches no record set is made: kept as family documents, or not at all
            hint: quiet
              ? `family documents: strom intake "${a}" --documents`
              : `scans of a register: strom recordset add "<the book>" … then strom media add "${a}" --recordset B…\nif they are family documents after all: strom intake "${a}" --documents`,
          });
        return { folder: folder ? path.basename(p) : undefined, files };
      });
      // a file deleted for good (core/materialdelete.ts) is none: the same content brought again is new material
      const known = new Map(tree.list<Input>("input").filter((i) => i.sha && i.retracted?.reason !== "deleted").map((i) => [i.sha!, i.id]));
      const report: string[] = [];
      const added: Input[] = [];
      /** How each GEDCOM was read, where there is something to say (--json: on its input). */
      const notes = new Map<string, DecodingNote & { candidates?: ImportResult["candidates"]; differs?: ImportResult["differs"]; notJoined?: ImportResult["notJoined"]; notTaken?: ImportResult["notTaken"] }>();
      /** What came for the task: the new inputs, and those the research had of the same content. */
      const handed: string[] = [];
      let skipped = 0;
      let task: Task | undefined;
      tree.withTreeLock(() => {
        for (const group of groups) {
        const plain: Input[] = [];
        for (const file of group.files) {
          const sha = fileSha256(file);
          if (known.has(sha)) {
            skipped++;
            if (forTask) handed.push(known.get(sha)!);
            // a family tree imported before strom read its married names (_MARNM): said how they come in
            const had = tree.get<Input>(known.get(sha)!);
            if (!quiet && had && !importedTree(had)) {
              const missing = marriedNamesPlan(tree, had, treeText(file)).add.length;
              if (missing) report.push(`  ${ui(tree.lang, "ui.intake.married", { id: had.id, n: missing })}`);
            }
            continue;
          }
          const size = fs.statSync(file).size;
          const isText = size < 50 * 1024 * 1024 && [".ged", ".json", ".txt", ".md", ".csv"].includes(path.extname(file).toLowerCase());
          // as whatever saved it: a BOM (Notepad, PowerShell 5) or UTF-16 is still the same family tree; a GEDCOM of a
          // Windows program in its code page (1 CHAR ANSI, CP1250) read as the Strom app reads it
          const isGed = isText && path.extname(file).toLowerCase() === ".ged";
          const decoded = isGed ? decodeGedcom(fs.readFileSync(file)) : undefined;
          const text = decoded ? decoded.text : isText ? decodeText(fs.readFileSync(file)) : undefined;
          const kind = kindOf(file, text);
          const id = tree.peekId("I");
          let stored: string;
          if (size <= MAX_IN_TREE) {
            const rel = `inputs/${id}-${safeFolderName(path.basename(file))}`;
            if (!tree.dryRun) {
              tree.remember(path.join(tree.root, rel));
              fs.copyFileSync(file, path.join(tree.root, rel));
            }
            stored = rel;
          } else stored = `media:${path.relative(ctx.settings.shared()!.value, tree.dryRun ? file : storeShared(ctx.settings.shared()!.value, file, sha))}`;
          const input = create<Input>(
            tree,
            "input",
            { name: path.basename(file), file: stored, sha, size, mime: mimeOf(file), from: ctx.display(file), kind, state: "new", ...(persons.length ? { persons } : {}), ...(note ? { note } : {}) },
            (iid) => `+${iid} input ${kind} "${truncate(path.basename(file), 50)}"`,
          );
          known.set(sha, input.id);
          let imported: ImportResult | undefined;
          if (kind === "tree" && !opts["no-import"] && text !== undefined) {
            imported = path.extname(file).toLowerCase() === ".ged"
              ? importGedcom(tree, text, { input: input.id, name: input.name, sha, pendingIds: pendingIds(tree) })
              : importStromJson(tree, JSON.parse(text), { input: input.id, name: input.name });
            update<Input>(tree, input.id, "input", (i) => ({ ...i, source: imported!.source, imported: { persons: imported!.persons, families: imported!.families, sources: 1 } }), {
              op: "input.imported",
              summary: `${input.id} imported: ${imported.persons} persons, ${imported.families} families${imported.matched ? `, ${imported.matched} matched` : ""}`,
            });
            const back = imported.matched - (imported.matchedByIds ?? 0) > 0 && imported.matched - (imported.matchedByIds ?? 0) >= imported.persons;
            // what the person reads while the research happens — whoever ran it, the agent too: the research's
            // language (where nobody researches, without the review talk)
            report.push(
              `  ${ui(tree.lang, "ui.intake.tree", { id: input.id, persons: imported.persons, families: imported.families, events: imported.events, source: imported.source })}${imported.matched ? ui(tree.lang, "ui.intake.tree.matched", { n: imported.matched }) : ""}${!quiet && imported.problems.length ? ui(tree.lang, "ui.intake.tree.unreadable", { n: imported.problems.length }) : ""}`,
            );
            if (!quiet && imported.extended.length) report.push(`  ${ui(tree.lang, "ui.intake.extended", { list: `${imported.extended.slice(0, 6).join(" · ")}${imported.extended.length > 6 ? " …" : ""}` })}`);
            // people the IDs of the program point at, not joined: for a person to decide (spec 066 K3.2)
            if (imported.candidates.length)
              report.push(`  ${ui(tree.lang, "ui.intake.candidates", { list: `${imported.candidates.slice(0, 6).map((c) => `${c.person}≈${c.like}`).join(", ")}${imported.candidates.length > 6 ? " …" : ""}` })}`);
            // the same people by the IDs of a newer file of the same program's tree, said otherwise there: leads beside
            const differs = imported.differs ?? [];
            if (differs.length) {
              const word = (why: string) => why.split(", ").map((w) => ui(tree.lang, w === "name differs" ? "ui.intake.differs.name" : w === "sex differs" ? "ui.intake.differs.sex" : "ui.intake.differs.year")).join(", ");
              report.push(`  ${ui(tree.lang, "ui.intake.differs", { list: `${differs.slice(0, 6).map((d) => `${d.person} (${word(d.why)})`).join(", ")}${differs.length > 6 ? " …" : ""}` })}`);
            }
            // a person made new though maybe one already in the family: not put in it twice
            const notJoined = imported.notJoined ?? [];
            if (notJoined.length)
              report.push(`  ${ui(tree.lang, "ui.intake.notJoined", { list: `${notJoined.slice(0, 6).map((n) => `${n.person} → ${n.family} (≈${n.like})`).join(", ")}${notJoined.length > 6 ? " …" : ""}` })}`);
            // what the file holds that the research does not take, said once
            const nt = imported.notTaken;
            const ntList = nt
              ? [
                  ...(nt.objects ? [ui(tree.lang, "ui.intake.notTaken.objects", { n: nt.objects })] : []),
                  ...(nt.links ? [ui(tree.lang, "ui.intake.notTaken.links", { n: nt.links })] : []),
                  ...Object.entries(nt.tags).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8).map(([t, n]) => `${t} ×${n}`),
                ]
              : [];
            if (ntList.length) report.push(`  ${ui(tree.lang, "ui.intake.notTaken", { list: `${ntList.join(", ")}${nt && Object.keys(nt.tags).length > 8 ? " …" : ""}` })}`);
            if (imported.candidates.length || ntList.length || differs.length || notJoined.length)
              notes.set(input.id, { ...notes.get(input.id), ...(imported.candidates.length ? { candidates: imported.candidates } : {}), ...(differs.length ? { differs } : {}), ...(notJoined.length ? { notJoined } : {}), ...(ntList.length ? { notTaken: imported.notTaken } : {}) });
            // the research's own tree coming back: sync sees what was changed in it too, not only what was added
            if (back) report.push(`  ${ui(tree.lang, "ui.intake.tree.back", { file: ctx.display(file) })}`);
            if (!quiet) {
              const system = `gedcom:${sha.slice(0, 12)}`;
              const dupes = likelyDuplicates(tree, tree.list<Person>("person").filter((p) => p.refs?.some((r) => r.system === system)).map((p) => p.id), sameFamily(tree), twoPeople(tree));
              if (dupes.length) report.push(`  ${ui(tree.lang, "ui.intake.dupes", { list: dupes.map((d) => `${d.person.id}≈${d.same.id}`).join(", ") })}`);
            }
          }
          // the code page it was read in, the characters it could not read: said, never replaced in silence
          const read = decoded ? decodingNote(decoded) : {};
          if (read.encoding || read.unreadable) {
            notes.set(input.id, { ...notes.get(input.id), ...read });
            report.push(...decodingSaid(tree.lang, input.id, read).map((l) => `  ${l}`));
          }
          // A family tree gets its own review task; the other files of a folder share one — files for a task: none
          if (forTask) handed.push(input.id);
          else if (kind === "tree" || !group.folder) intakeTask(tree, input, research, imported, persons);
          else plain.push(input);
          added.push(input);
        }
        if (plain.length) groupTask(tree, plain, research, undefined, group.folder, persons);
        }
        if (forTask) {
          // the same content again: what is said of it now (the task's people, the note) added — no task of its own
          for (const id of handed.filter((h) => !added.some((i) => i.id === h)))
            if (id.startsWith("I")) amendInput(tree, id, { persons, note }, { again: false, app: false });
          task = handFiles(tree, forTask.id, handed, fileBy(tree, ctx.env));
        }
        if (typeof opts.text === "string" && opts.text.trim()) {
          const input = create<Input>(tree, "input", { name: truncate(opts.text, 60), text: opts.text.trim(), kind: "text", state: "new", from: "user", ...(persons.length ? { persons } : {}) }, (iid) => `+${iid} input text`);
          intakeTask(tree, input, research, undefined, persons);
          added.push(input);
        }
      });
      // what came, in the research's language: a person follows it, also where the agent ran it (in its session)
      const tasks = tree.written.filter((o) => o.op === "task.add").length;
      // a tree the Strom app has: where the material is there (its Materials, at the person)
      const inApp = added.length > 0 && appHasTree(tree.root, ctx.settings);
      const text = lines(
        added.length
          ? `${ui(tree.lang, quiet ? (isArchive(tree) ? "ui.intake.done.archive" : "ui.intake.done.waiting") : "ui.intake.registered", { n: added.length })}${skipped ? ` ${ui(tree.lang, "ui.intake.same", { n: skipped })}` : ""}${inApp ? ` ${ui(tree.lang, "ui.intake.app")}` : ""}`
          : ui(tree.lang, "ui.intake.known"),
        added.length ? table(added.map((i) => [`  ${i.id}`, i.kind, truncate(i.name, 60)])) : undefined,
        ...report,
        !quiet && tasks ? `\n${ui(tree.lang, "ui.intake.tasks", { n: tasks })}` : undefined,
        task ? ui(tree.lang, "ui.intake.handed", { task: task.id, inputs: [...new Set(handed)].join(", ") }) : undefined,
      );
      return { text, data: { inputs: added.map((i) => ({ ...i, ...notes.get(i.id) })), skipped, ...(task ? { task: task.id, handed: [...new Set(handed)], state: task.state } : {}) } };
    },
  },
  {
    path: ["input", "list"],
    summary: "Inputs of this tree and their state",
    group: "inputs",
    tree: true,
    options: [{ name: "state", type: "string", value: "<state>", description: "new, processed or skipped" }, { name: "full", type: "boolean", description: "--json: whole records instead of one row each" }],
    run(ctx, { opts }) {
      // a file deleted for good is none (as in the Strom app, GET /material): strom input show <ID> still says when
      const all = ctx.tree().list<Input>("input").filter((i) => i.retracted?.reason !== "deleted" && (!opts.state || i.state === opts.state));
      const page = paginate(all, ctx.limit, ctx.page);
      return {
        // a file read already (strom document read) says so: its reading, not read again
        text: all.length ? lines(table(page.items.map((i) => [i.id, i.kind, i.state, truncate(i.name, 60), i.read?.length ? `read ${i.read[i.read.length - 1]} (strom readings ${i.read[i.read.length - 1]})` : ""])), moreLine(page, "strom input list")) : 'no inputs → strom intake <files or folder>',
        data: { total: all.length, inputs: opts.full ? page.items : page.items.map((i) => ({ id: i.id, kind: i.kind, state: i.state, name: i.name, ...(i.read?.length ? { read: i.read } : {}) })) },
      };
    },
  },
  {
    path: ["input", "show"],
    summary: "One input: where the file is (to read it), what came of it",
    group: "inputs",
    tree: true,
    args: [{ name: "input", description: "input ID (I0001)", required: true }],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const i = requireRecord<Input>(tree, args[0]!, "input");
      // deleted for good (strom input delete, the Strom app): said so, never a file to look for or bring back
      const deleted = i.retracted?.reason === "deleted" ? i.retracted.at : undefined;
      const abs = deleted ? undefined : inputPath(tree, i);
      // the file gone (the shared folder not brought along, deleted by hand): said, never shown as if it were there
      const missing = !!abs && !fs.existsSync(abs);
      const tasks = tree.list<Task>("task").filter((t) => t.where.includes(i.id));
      const text = lines(
        `${i.id} ${i.name}  [${i.kind} · ${deleted ? `deleted for good ${deleted.slice(0, 10)}` : i.state}]`,
        deleted ? "file   none: deleted for good by the person (the same content brought again is new material)" : undefined,
        abs ? `file   ${abs}${missing ? ` — missing on this computer: bring back the ${i.file?.startsWith("media:") ? "shared folder from a backup of the whole Strom folder (its subfolder shared)" : "research's folder from a backup"}` : ""}` : undefined,
        i.from ? `from   ${i.from}` : undefined,
        i.batch ? `batch  ${i.batch}${i.path ? ` · ${i.path}` : ""}` : undefined,
        i.persons?.length ? `of     ${i.persons.join(", ")}` : undefined,
        i.sorted ? `sorted ${i.sorted.as}${i.sorted.source ? ` → ${i.sorted.source}` : ""}${i.sorted.reason ? ` (${i.sorted.reason})` : ""}` : undefined,
        i.mime ? `type   ${i.mime}${i.size !== undefined ? ` · ${Math.round(i.size / 1024)} kB` : ""}` : undefined,
        i.imported ? `import ${i.imported.persons} persons, ${i.imported.families} families as leads, cited as ${i.source}` : undefined,
        i.read?.length ? `read   ${readingsLine(tree, i)}` : undefined,
        i.text ? `\n${i.text}` : undefined,
        !i.text && i.kind === "text" && abs && fs.existsSync(abs) && (i.size ?? 0) < 20_000 && /\.(txt|md|csv)$/i.test(abs) ? `\n${fs.readFileSync(abs, "utf8").trim()}` : undefined,
        tasks.length ? `\ntasks\n${table(tasks.map((t) => [`  ${t.id}`, t.state, truncate(t.what, 60)]))}` : undefined,
        ...i.notes.map((n) => `note   ${n.text}`),
        i.kind === "document" && abs && !missing && !readingsOf(tree, i).some((r) => r.state === "done")
          ? `\nread the file (a big image: strom media view ${i.id} --grid, then --crop), then record what it says: strom source add … --input ${i.id}`
          : undefined,
      );
      return { text, data: { input: i, path: abs, ...(deleted ? { deleted } : {}), ...(missing ? { missing: true } : {}), tasks: tasks.map((t) => t.id), ...(i.read?.length ? { readings: readingsOf(tree, i) } : {}) } };
    },
  },
  {
    path: ["input", "done"],
    summary: "Mark an input as processed",
    group: "inputs",
    tree: true,
    writes: true,
    args: [{ name: "input", description: "input ID", required: true }],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const id = normId(args[0]!, "input");
      update<Input>(tree, id, "input", (i) => ({ ...i, state: "processed" }), { op: "input.done", summary: `${id} processed` });
      return { text: lines(...tree.written.map((o) => o.summary)), data: { id } };
    },
  },
  {
    path: ["input", "skip"],
    summary: "Mark an input as not useful (with the reason)",
    group: "inputs",
    tree: true,
    writes: true,
    args: [{ name: "input", description: "input ID", required: true }],
    examples: ['strom input skip I0003 --reason "the same letter as I0002"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      if (!opts.reason) throw new UsageError("--reason is required");
      const id = normId(args[0]!, "input");
      // the state it had kept: strom input unskip gives it back
      update<Input>(
        tree,
        id,
        "input",
        (i) => (i.state === "skipped" ? i : { ...i, state: "skipped", hidden: { at: new Date().toISOString(), by: fileBy(tree, ctx.env), was: i.state === "processed" ? "processed" : "new" } }),
        { op: "input.skip", summary: `${id} skipped`, reason: String(opts.reason) },
      );
      return { text: lines(...tree.written.map((o) => o.summary), `take it back: strom input unskip ${id}`), data: { id } };
    },
  },
  {
    path: ["input", "unskip"],
    summary: "Take back a skip or a hide: the files of the material as they were before (the bridge runs it for the Strom app's Show again)",
    group: "inputs",
    tree: true,
    writes: true,
    description:
      "Each skipped or hidden file gets back the state it had: new, or processed when a source was made of it. One that\n" +
      "waits again and that no task holds gets an intake task (in an archive put aside); sorted as unrelated, that sorting\n" +
      "goes (the history keeps it). A file not skipped: nothing. Many files: --files-from <file> (one ID a line; - = stdin).",
    args: [{ name: "inputs", description: "input IDs (I0001 …)", variadic: true, unless: ["files-from"] }],
    options: [{ name: "files-from", type: "string", value: "<file|->", description: "the input IDs from a file, one a line (- = stdin)" }],
    examples: ["strom input unskip I0003", "strom input unskip --files-from ids.txt"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const ids = idsGiven(ctx, args, opts);
      const before = filesOfTasks(tree);
      const got = tree.withTreeLock(() => unhideMaterial(tree, ids));
      const tasks = got.tasks.map((id) => ui(tree.lang, "ui.input.task.gather", { task: id, what: tree.get<Task>(id)?.what ?? "" }));
      return { text: got.changed.length ? lines(...materialLines(tree, before), ...tasks) : ui(tree.lang, "ui.input.unskip.none"), data: got };
    },
  },
  {
    path: ["input", "hide"],
    summary: "Hide files of the material — nothing of the family, the same as another (the bridge runs it for the Strom app's Hide)",
    group: "inputs",
    tree: true,
    writes: true,
    description:
      "The files are skipped, the state each had kept: strom input unskip shows them again. A task holding one lets it go\n" +
      "(given up when none of its files is left), so nobody sorts it. Nothing is deleted; the original stays. The Strom\n" +
      "app lists hidden files as hidden. An agent sorting a batch says what a file is with strom input sort instead.",
    args: [{ name: "inputs", description: "input IDs (I0001 …)", variadic: true, unless: ["files-from"] }],
    options: [
      { name: "why", type: "string", value: "<code>", description: `${HIDE_REASONS.join(" or ")} (or none)` },
      { name: "files-from", type: "string", value: "<file|->", description: "the input IDs from a file, one a line (- = stdin)" },
    ],
    examples: ["strom input hide I0003 --why unrelated", "strom input hide I0003 I0005 --why duplicate"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const why = typeof opts.why === "string" ? opts.why.trim() : undefined;
      if (why !== undefined && !(HIDE_REASONS as readonly string[]).includes(why))
        throw new UsageError(`--why: ${HIDE_REASONS.join(" or ")}`, { code: "material.body", params: { why: why.slice(0, 40) } });
      const ids = idsGiven(ctx, args, opts);
      const before = filesOfTasks(tree);
      const got = tree.withTreeLock(() => hideMaterial(tree, ids, { reason: why as (typeof HIDE_REASONS)[number] | undefined, by: fileBy(tree, ctx.env) }));
      return {
        text: got.changed.length ? lines(...materialLines(tree, before), ui(tree.lang, "ui.input.hide.back", { ids: got.changed.length > 3 ? "…" : got.changed.join(" ") })) : ui(tree.lang, "ui.input.hide.none"),
        data: got,
      };
    },
  },
  {
    path: ["input", "assign"],
    summary: "Add the people files of the material are of, or take them off (the bridge runs it for the Strom app's Assign)",
    group: "inputs",
    tree: true,
    writes: true,
    description:
      "Of each file given, or of a whole batch (--batch: its people, and each of its files). All or nothing: a file or a\n" +
      "person the research does not have, and nothing is written. Adding makes no task and never puts a sorted file back\n" +
      "to new; a file that still waits, its task is of the person too. Taken off a file, a person the whole batch is of\n" +
      "stays (said: take it off the batch). The same again: nothing written. Many files: --files-from (one ID a line).",
    args: [{ name: "inputs", description: "input IDs (I0001 …)", variadic: true, unless: ["files-from", "batch"] }],
    options: [
      { name: "add", type: "string", multiple: true, value: "<P…>", description: "a person the files are of (repeatable)" },
      { name: "remove", type: "string", multiple: true, value: "<P…>", description: "a person they are not of (repeatable)" },
      { name: "batch", type: "string", value: "<mark>", description: "a whole batch instead of files (strom input batch)" },
      { name: "files-from", type: "string", value: "<file|->", description: "the input IDs from a file, one a line (- = stdin)" },
    ],
    examples: ["strom input assign I0003 I0005 --add P0001 --add P0004", "strom input assign I0005 --remove P0004", "strom input assign --batch 4f1c2a9e-0b7d-4c55-9a7e-3d2c1b0a9f88 --remove P0004"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const people = (v: unknown) => (Array.isArray(v) ? v : v ? [v] : []).flatMap((p) => String(p).split(",")).map((p) => p.trim()).filter(Boolean);
      const batch = typeof opts.batch === "string" ? opts.batch.trim() : undefined;
      if (batch && (args.length || opts["files-from"])) throw new UsageError("give the files or --batch, not both", { code: "material.body" });
      const got = tree.withTreeLock(() => assignMaterial(tree, { ...(batch ? { batch } : { files: idsGiven(ctx, args, opts) }), add: people(opts.add), remove: people(opts.remove) }));
      return {
        text: lines(
          got.changed.length ? lines(...materialLines(tree, new Map(), got.batch)) : ui(tree.lang, "ui.input.assign.none"),
          ...got.kept.map((k) => ui(tree.lang, "ui.input.assign.kept", { id: k.id, who: whoOf(tree, [k.person]), batch: k.batch, person: k.person })),
        ),
        data: got,
      };
    },
  },
  {
    path: ["input", "edit"],
    summary: "Give files of the material a title, a kind, a date — or take them off (the bridge runs it for the Strom app's revision of the material)",
    group: "inputs",
    tree: true,
    writes: true,
    description:
      `Of each file given (at most ${MATERIAL_MOST_EDIT}), the research's material and the files of the Strom app's tree alike (the\n` +
      "app's next file of the tree has them). All or nothing: a file the research does not have, a title longer than\n" +
      `${MATERIAL_TITLE_MAX} characters, a kind or a date it cannot read, and nothing is written. "" takes a value off. Answered\n` +
      "with what each file had before (`was`): the same edit with those values takes it back. Many files: --files-from\n" +
      "<file> (one ID a line; - = stdin).",
    args: [{ name: "inputs", description: "input IDs (I0001 …)", variadic: true, unless: ["files-from"] }],
    options: [
      { name: "title", type: "string", value: "<text>", max: MATERIAL_TITLE_MAX, description: "what to call it (\"\" takes it off)" },
      { name: "kind", type: "string", value: "<kind>", description: `${MATERIAL_KINDS.join(", ")} (\"\" takes it off)` },
      { name: "date", type: "string", value: "<date>", description: "when it was written or taken (GEDCOM: 1932, ABT 1930, 12 MAY 1932; \"\" takes it off)" },
      { name: "files-from", type: "string", value: "<file|->", description: "the input IDs from a file, one a line (- = stdin)" },
    ],
    examples: ['strom input edit I0003 --title "<what the photo shows>" --kind photo --date "ABT 1930"', 'strom input edit I0003 I0005 --date ""'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const value = (v: unknown) => (typeof v === "string" ? v : undefined);
      const ids = idsGiven(ctx, args, opts);
      const got = tree.withTreeLock(() => editMaterial(tree, ids, { title: value(opts.title), kind: value(opts.kind), date: value(opts.date) }, fileBy(tree, ctx.env)));
      const before = new Map(Object.entries(got.was).map(([id, w]) => [`edit:${id}`, Object.keys(w)]));
      return { text: got.changed.length ? lines(...materialLines(tree, before)) : ui(tree.lang, "ui.input.assign.none"), data: got };
    },
  },
  {
    path: ["input", "delete"],
    summary: "Delete files of the material for good — the person's alone, never an agent's (the bridge runs it for the Strom app's Delete); --dry-run says what it takes",
    group: "inputs",
    tree: true,
    writes: true,
    description:
      `Of each file given (at most ${DELETE_MOST_FILES}): its record is taken back, its places in the Strom app's tree with it; a\n` +
      "source made of it keeps its text and citations, only its link to the file goes; a task holding it lets it go (given\n" +
      "up when none of its files is left). Its bytes (the original, its working copy, its previews) go only when no other\n" +
      "file of the research and no other research on this computer has the same content — then the images of sources of\n" +
      "that content and their excerpts go too (a source loses the image, never its text). All or nothing: a file the\n" +
      "research does not have, and nothing is written. --dry-run says all of it, file by file (--json: impacts). Without\n" +
      "it the person says yes in their own terminal (Enter says no), else in a window of the system; nobody to ask: exit\n" +
      "4. An agent never runs it, nor offers to run it for the person. It cannot be undone in the Strom app: a file stays\n" +
      "only in a backup (strom backup) or a pack made before. Many files: --files-from <file> (one ID a line; - = stdin).\n" +
      "A family tree's file (an imported GEDCOM, the app's JSON) is deleted the same way — unless a source of the research\n" +
      "was made of it and stands (exit with material.source-live): then only together with that source, --retract-sources\n" +
      "S… (deleted first, as strom source retract does; one yes for both; the source can be restored, without the file).\n" +
      "Everything is checked first and written in one commit; the bytes go only after it.",
    args: [{ name: "inputs", description: "input IDs (I0001 …)", variadic: true, unless: ["files-from"] }],
    options: [
      { name: "files-from", type: "string", value: "<file|->", description: "the input IDs from a file, one a line (- = stdin)" },
      { name: "retract-sources", type: "string", value: "<S…,S…>", description: "the sources made of a family tree's file, deleted with it (the person's, as strom source retract)" },
      // the Strom app's yes: what its bridge signed of the list the person saw there (POST /material/delete)
      { name: "confirm", type: "string", value: "<token>", hidden: true, description: "the Strom app's confirmation, signed by its bridge" },
    ],
    examples: ["strom input delete I0003 --dry-run", "strom input delete I0003 I0005", "strom input delete I0004 --retract-sources S0004 --dry-run"],
    async run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const shared = ctx.settings.shared()?.value;
      const impacts = deleteImpacts(tree, shared, idsGiven(ctx, args, opts));
      const files = impacts.map((i) => i.id);
      const lang = tree.lang;
      // the sources made of a family tree's file, deleted with it (spec 117 K2.2): checked whole first
      const given = typeof opts["retract-sources"] === "string" ? opts["retract-sources"].split(/[\s,]+/u).filter(Boolean) : [];
      if (given.length > RETRACT_MOST) throw new UsageError(`at most ${RETRACT_MOST} sources at once`, { code: "material.body", params: { most: String(RETRACT_MOST) }, hint: "strom help input delete" });
      checkRetractWith(impacts, given);
      const sourceImpacts = deleteSourceImpacts(tree, given);
      const sources = sourceImpacts.map((s) => s.id);
      const both = sources.length ? { sources, impacts: sourceImpacts } : undefined;
      if (ctx.dryRun) return { text: lines(...sourceImpacts.map((s) => wouldLine(lang, s)), ...impacts.map((i) => deleteWould(lang, i))), data: { files, impacts, ...(both ? { retractSources: sources, sourceImpacts } : {}) } };
      // a family tree's file with a source standing: never without it
      refuseLiveSources(impacts, sources);
      if (typeof opts.confirm === "string") {
        // the Strom app's: its bridge signed the list the person saw and said yes to there — only that list, only a while.
        // An agent's marks outweigh STROM_FOR_APP (the bridge runs this without them): an agent never deletes, not even
        // with a confirmation it got hold of
        if (isAgent(ctx.env))
          throw new UsageError("an agent never deletes files of the material for good, not even with the Strom app's confirmation: nothing deleted", { code: "material.agent", hint: "the person deletes them in the Strom app, or says yes to strom input delete in their own terminal" });
        const said = ctx.env.STROM_FOR_APP === "1" ? checkDeleteConfirm(tree.key, files, impacts, opts.confirm, Date.now(), both) : "invalid";
        if (said === "changed")
          throw new UsageError("the files would take other things with them than the person saw: nothing deleted", { code: "material.delete-changed", params: { files: files.join(",").slice(0, 200) }, hint: "the person looks at the list again in the Strom app" });
        if (said !== "ok") throw new UsageError("no confirmation of the Strom app that holds (signed by its bridge, at most 15 minutes old): nothing deleted", { code: "material.body", hint: "strom help input delete" });
      } else {
        const set = `strom input delete ${files.length > 10 ? `${files.slice(0, 10).join(" ")} …` : files.join(" ")}`;
        const says = [...(sources.length ? [ui(ctx.uiLang(), "ui.consent.delete.sources", { list: sources.join(", ") })] : []), ui(ctx.uiLang(), "ui.consent.delete", { n: String(files.length) })].join(" ");
        const how = await ctx.requireHumanYes(`Delete ${files.length} file(s) of the material for good (${files.slice(0, 10).join(", ")}${files.length > 10 ? " …" : ""})${sources.length ? `, and first the sources made of them (${sources.join(", ")})` : ""}? Only the user decides this; an agent never deletes nor offers to.`, `${set}${sources.length ? ` --retract-sources ${sources.join(",")}` : ""}`, "material.delete", says);
        if (!how) return { text: ui(ctx.uiLang(), "ui.consent.delete.no"), data: { files, deleted: [], impacts, ...(both ? { sourceImpacts } : {}) } };
      }
      const before = filesOfTasks(tree);
      const { removeBytes, ...got } = deleteMaterial(tree, shared, files, fileBy(tree, ctx.env), { retractSources: sources, via: ctx.env.STROM_FOR_APP === "1" ? "bridge" : "terminal" });
      // written first, in one commit; only then do the bytes go (spec 117 R7) — a commit that fails keeps them
      if (!autoCommit(ctx, { path: ["input", "delete"] } as never)) removeBytes();
      const out: string[] = [];
      for (const id of got.retracted ?? []) out.push(ui(lang, "ui.input.delete.retracted", { source: id }));
      for (const i of got.impacts) {
        out.push(ui(lang, "ui.input.deleted", { id: i.id, name: i.name }));
        if (i.keptWhy === "sameAs") out.push(ui(lang, "ui.input.delete.kept.sameAs", { id: i.id, same: (i.sameAs ?? []).join(", ") }));
        else if (i.keptWhy === "otherResearch") out.push(ui(lang, "ui.input.delete.kept.otherResearch", { id: i.id }));
      }
      for (const u of got.unlinked) out.push(ui(lang, "ui.input.delete.source", { source: u.source, id: u.file }));
      for (const m of got.images) out.push(ui(lang, "ui.input.delete.images", { source: m.source, n: String(m.images.length) }));
      for (const id of got.tasks) {
        const t = tree.get<Task>(id);
        const had = before.get(id) ?? [];
        if (t?.state === "dropped") out.push(ui(lang, "ui.input.delete.task.dropped", { task: id, files: had.join(", ") }));
        else out.push(ui(lang, "ui.input.delete.task.without", { task: id, files: had.filter((f) => !t?.where.includes(f)).join(", ") }));
      }
      return { text: lines(...out), data: got };
    },
  },
  {
    path: ["input", "amend"],
    summary: "Add to an input what is said of it again: the people it is of, the user's note (the bridge runs it when the Strom app sends a file the research has)",
    group: "inputs",
    tree: true,
    writes: true,
    description:
      "Only what the input lacks is added: the people not named yet (a couple's partners too), the couples, a note not given yet. When something came and no task\n" +
      "at hand holds the input, an intake task looks at it again (in an archive put aside). Nothing new: nothing written.",
    args: [{ name: "input", description: "input ID", required: true }],
    options: [
      { name: "person", type: "string", multiple: true, value: "<P…>", description: "a person it is of (repeatable)" },
      { name: "family", type: "string", multiple: true, value: "<F…>", description: "a couple it is of (repeatable): material of both partners" },
      { name: "note", type: "string", value: "<text>", description: "what the user said of it" },
    ],
    examples: ["strom input amend I0002 --person P0001 --note \"<what the user said of it>\""],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const id = normId(args[0]!, "input");
      const persons = (Array.isArray(opts.person) ? opts.person : opts.person ? [opts.person] : []).flatMap((p) => String(p).split(",")).map((p) => p.trim().toUpperCase()).filter(Boolean);
      const families = (Array.isArray(opts.family) ? opts.family : opts.family ? [opts.family] : []).flatMap((f) => String(f).split(",")).map((f) => f.trim().toUpperCase()).filter(Boolean);
      const got = tree.withTreeLock(() => amendInput(tree, id, { persons, note: typeof opts.note === "string" ? opts.note : undefined, ...(families.length ? { families } : {}) }));
      return { text: tree.written.length ? lines(...tree.written.map((o) => o.summary)) : `${id}: nothing new`, data: got };
    },
  },
  {
    path: ["input", "names"],
    summary: "The married names (_MARNM) of a family tree imported before strom read them: shown, --apply adds them",
    group: "inputs",
    tree: true,
    writes: true,
    // what it would add reads only: anybody's, also on a research sealed on another computer
    writesWith: ({ opts }) => !!opts.apply || !!opts.undo,
    description:
      "strom before 1.16 left out the married names other programs write as _MARNM (MyHeritage, Legacy, PAF). This reads\n" +
      "the file the research was started from again — the input it keeps — and finds the people imported from it by the\n" +
      "IDs the import kept (nobody else). Only names of the married kind are added, beside the name each person is shown\n" +
      "by, citing the import's source; a person who has the name already stays as they are; people of the file not in the\n" +
      "research are only listed. Without --apply only shown; --apply is one commit; --undo takes back what it added.\n" +
      "Another export of the tree (another file) is not paired: give the input the research has (strom input list).",
    args: [{ name: "input", description: "the imported family tree: its input (I…), or the same file", required: true }],
    options: [
      { name: "apply", type: "boolean", description: "add them (without: only show)" },
      { name: "undo", type: "boolean", description: "take back the married names it added from this input" },
    ],
    examples: ["strom input names I0004", "strom input names ~/Downloads/rodokmen.ged --apply", "strom input names I0004 --undo"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const arg = args[0]!;
      const inputs = tree.list<Input>("input");
      let input = /^I?\d+$/i.test(arg.trim()) ? inputs.find((i) => i.id === normId(arg, "input")) : undefined;
      if (!input) {
        const p = ctx.resolvePath(arg);
        if (!fs.existsSync(p) || !fs.statSync(p).isFile()) {
          // an input's ID this research does not have (a file of that name neither)
          if (/^I?\d+$/i.test(arg.trim()))
            throw new UsageError(`no input ${normId(arg, "input")} in this research`, { hint: "strom input list", code: "input.names.missing", params: { input: normId(arg, "input") } });
          throw notFound(arg);
        }
        const sha = fileSha256(p);
        input = inputs.find((i) => i.sha === sha);
        if (!input)
          throw new UsageError(`${ctx.display(p)} is not a family tree this research was started from (another file, another export)`, {
            hint: "the research keeps the file it imported: strom input list — then strom input names I…",
            code: "input.names.other-file",
          });
      }
      const why = importedTree(input);
      if (why) throw new UsageError(why, { hint: "strom input list — a family tree imported from GEDCOM (kind tree)", code: "input.names.not-imported", params: { input: input.id } });
      const name = (id: string) => {
        const p = tree.get<Person>(id);
        return p?.names[0] ? gedcomName(p.names[0]).replace(/\//g, "").replace(/\s+/g, " ").trim() : id;
      };
      if (opts.undo) {
        const gone = undoMarriedNames(tree, input);
        return {
          text: gone.length ? lines(...gone.map((g) => `  ${g.person} ${name(g.person)}: − ${gedcomName(g.name)}`), `${counted(gone.length, "married name")} from ${input.id} taken back`) : `${input.id}: no married name of it to take back`,
          data: { input: input.id, undone: gone.map((g) => ({ person: g.person, name: gedcomName(g.name) })) },
        };
      }
      const file = inputPath(tree, input);
      if (!file || !fs.existsSync(file)) throw new UsageError(`the file of ${input.id} is not here (${input.file ?? "none"})`, { hint: `strom input show ${input.id}`, code: "input.names.no-file", params: { input: input.id } });
      const plan = marriedNamesPlan(tree, input, treeText(file));
      if (opts.apply && plan.add.length) addMarriedNames(tree, plan);
      const done = !!opts.apply && !tree.dryRun;
      const text = lines(
        `${input.id} ${input.name}: ${counted(plan.add.length, "married name")} ${done ? "added" : "to add"}, ${plan.have.length} already there, ${counted(plan.unpaired.length, "person", "people")} of the file not in the research`,
        ...plan.add.map((a) => `  ${a.person} ${name(a.person)}: + ${gedcomName(a.name)} (married)`),
        plan.unpaired.length ? "not in the research (nothing added):" : undefined,
        ...plan.unpaired.map((u) => `  ${u.xref} ${u.name.replace(/\//g, "").replace(/\s+/g, " ").trim()}: ${u.married.map(gedcomName).join(", ")}`),
        plan.add.length && !opts.apply ? `\nadd them: strom input names ${input.id} --apply` : undefined,
        done && plan.add.length ? `take them back: strom input names ${input.id} --undo` : undefined,
      );
      const row = (a: { person: string; xref: string; name: Name }) => ({ person: a.person, xref: a.xref, name: gedcomName(a.name) });
      return {
        text,
        data: { input: input.id, source: plan.source, applied: done, add: plan.add.map(row), have: plan.have.map(row), unpaired: plan.unpaired.map((u) => ({ xref: u.xref, name: u.name, married: u.married.map(gedcomName) })) },
      };
    },
  },
  {
    path: ["input", "batch"],
    summary: "Batches of material the Strom app sent: how many files, how far they are sorted",
    group: "inputs",
    tree: true,
    run(ctx) {
      const tree = ctx.tree();
      const all = batchStatus(tree) as { id: string; name?: string; state: string; files: number; known: number; refused: number; sorted: number; kept?: boolean; tasks: string[] }[];
      return {
        text: all.length
          ? table(all.map((b) => [b.id.slice(0, 12), b.state, b.kept ? `${b.files} kept` : `${b.sorted}/${b.files} sorted`, b.known ? `${b.known} known` : "", b.refused ? `${b.refused} refused` : "", truncate(b.name ?? "", 40), b.tasks.join(" ")]))
          : "no batch from the Strom app",
        data: { batches: all },
      };
    },
  },
  {
    path: ["input", "batch", "done"],
    summary: "Close a batch from the Strom app: its files become sorting tasks of about 25 each (the bridge runs it)",
    group: "inputs",
    tree: true,
    writes: true,
    description:
      "The app says the batch is whole (POST <token>/batch/<id>/done), or the bridge closes it a day after its last file\n" +
      "(--idle). Its new files become intake tasks, by the folders they came in; in an archive they wait put aside.",
    args: [{ name: "batch", description: "the batch's mark", required: true }],
    options: [
      { name: "name", type: "string", value: "<name>", description: "its name (\"Krabice od babičky\")" },
      { name: "person", type: "string", multiple: true, value: "<P…>", description: "the person it is all of (repeatable)" },
      { name: "expected", type: "string", value: "<n>", description: "how many files the app sent" },
      { name: "idle", type: "boolean", description: "closed because no file came for a day" },
      { name: "note", type: "string", value: "<text>", description: "the user's note to the whole batch (told in its tasks)" },
    ],
    examples: ["strom input batch done 4f1c2a9e-0b7d-4c55-9a7e-3d2c1b0a9f88 --name \"Krabice od babičky\""],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const id = args[0]!;
      if (!readBatch(tree.root, id)) throw new UsageError(`no batch ${id} here`, { hint: "strom input batch" });
      const persons = checkOriginalMeta(tree, { persons: (Array.isArray(opts.person) ? opts.person : opts.person ? [opts.person] : []).map((p) => String(p).trim().toUpperCase()) }).persons;
      const b = tree.withTreeLock(() => closeBatch(tree, id, { name: typeof opts.name === "string" ? opts.name : undefined, persons, expected: Number(opts.expected) || undefined, note: typeof opts.note === "string" ? opts.note : undefined, why: opts.idle ? "idle" : "app" }));
      const data = { batch: b.id, name: b.name, inputs: b.inputs.length, known: b.known.length, refused: b.refused.length, nested: b.nested, tasks: b.tasks };
      return { text: lines(...tree.written.map((o) => o.summary), `${counted(b.inputs.length, "file")} taken, ${b.known.length} known already, ${b.refused.length} refused — ${counted(b.tasks.length, "task")} to sort them`), data };
    },
  },
  {
    path: ["input", "sort"],
    summary: "Say what files of the material are: a record, a document, a photo — of whom — or nothing of the family",
    group: "inputs",
    tree: true,
    writes: true,
    description:
      "Sorting a batch: each file's kind and the person it is of. source: a record (give --source S… once it is recorded);\n" +
      "document, photo: the family's own; unrelated: nothing of the family (--reason; it is skipped, nothing of it is written).\n" +
      "What a file says is recorded as from any material; sorting only says what it is.",
    args: [{ name: "inputs", description: "input IDs (I0001 …)", variadic: true }],
    options: [
      { name: "as", type: "string", value: "<kind>", description: `${SORT_KINDS.join(", ")}` },
      { name: "person", type: "string", multiple: true, value: "<P…>", description: "a person it is of (repeatable)" },
      { name: "source", type: "string", value: "<S…>", description: "the source recorded from it (with --as source)" },
      { name: "reason", type: "string", value: "<text>", description: "why (required with unrelated: \"the same as I0012\", \"a holiday photo of strangers\")" },
      { name: "title", type: "string", value: "<text>", max: 200, description: "what to call it, in the research's language (one file): \"<a wedding, the place, the year>\"" },
      { name: "date", type: "string", value: "<date>", description: "when it was written or taken (GEDCOM: 1932, ABT 1930, 12 MAY 1932)" },
    ],
    examples: ["strom input sort I0001 I0002 --as photo --person P0001", 'strom input sort I0005 --as photo --title "<what the photo shows>" --date "ABT 1930"', 'strom input sort I0003 --as unrelated --reason "a tax form of 1998"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      if (!args.length) throw new UsageError("give the inputs (I…)");
      const as = String(opts.as ?? "");
      if (!(SORT_KINDS as readonly string[]).includes(as)) throw new UsageError(`--as: one of ${SORT_KINDS.join(", ")}`);
      const reason = typeof opts.reason === "string" ? opts.reason.trim() : "";
      if (as === "unrelated" && !reason) throw new UsageError("--reason is required with unrelated", { hint: 'e.g. --reason "the same as I0012"' });
      const source = typeof opts.source === "string" ? requireRecord<Source>(tree, opts.source, "source").id : undefined;
      const persons = checkOriginalMeta(tree, { persons: (Array.isArray(opts.person) ? opts.person : opts.person ? [opts.person] : []).map((p) => String(p).trim().toUpperCase()) }).persons;
      const ids = args.map((a) => requireRecord<Input>(tree, a, "input").id);
      const title = typeof opts.title === "string" ? opts.title.replace(/[\p{Cc}]/gu, " ").replace(/\s+/gu, " ").trim().normalize("NFC").slice(0, 200) : undefined;
      if (title && ids.length > 1) throw new UsageError("--title names one file: sort the others apart", { hint: `strom input sort ${ids[0]} --as ${as} --title …` });
      const date = typeof opts.date === "string" ? normalizeDate(opts.date) : undefined;
      if (typeof opts.date === "string" && !date) throw new UsageError(`--date: "${opts.date}" is no date (GEDCOM: 1932, ABT 1930, 12 MAY 1932)`);
      const at = new Date().toISOString();
      tree.withTreeLock(() => {
        for (const id of ids)
          update<Input>(
            tree,
            id,
            "input",
            (i) => ({
              ...i,
              ...(persons.length ? { persons: [...new Set([...(i.persons ?? []), ...persons])] } : {}),
              ...(source ? { source } : {}),
              ...(title ? { title } : {}),
              ...(date ? { date } : {}),
              // nothing of the family: hidden, the state it had kept (strom input unskip gives it back)
              ...(as === "unrelated" && i.state !== "skipped" ? { state: "skipped" as const, hidden: { at, by: tree.actor, reason: "unrelated" as const, was: i.state === "processed" ? ("processed" as const) : ("new" as const) } } : {}),
              sorted: { as: as as (typeof SORT_KINDS)[number], ...(persons.length ? { persons } : {}), ...(source ? { source } : {}), ...(reason ? { reason } : {}), at, by: tree.actor },
            }),
            { op: "input.sort", summary: `${id} ${as}${persons.length ? ` of ${persons.join(", ")}` : ""}${source ? ` → ${source}` : ""}`, ...(reason ? { reason } : {}), targets: persons },
          );
      });
      return { text: lines(...tree.written.map((o) => o.summary)), data: { inputs: ids, as } };
    },
  },
);
