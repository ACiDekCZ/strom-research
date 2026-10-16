// intake · input list · show · skip · done — what a research starts from.
//
// Anything can be an input: a folder of scans and documents, a GEDCOM file,
// a tree exported from the Strom app, a text the user types. Inputs are the
// unchanged BASE of a research; the agent builds the working tree from them
// through tasks, and the tree it builds is exported as GEDCOM.

import fs from "node:fs";
import path from "node:path";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, moreLine, paginate, table, truncate } from "../cli/format.ts";
import { notFound, UsageError } from "../core/errors.ts";
import type { Input, Person, Research, Task } from "../core/model.ts";
import { likelyDuplicates } from "../core/people.ts";
import { collectFiles, fileSha256, inputPath, MAX_IN_TREE, mimeOf, storeShared } from "../core/media.ts";
import { create, normId, requireRecord, update } from "../core/records.ts";
import { phrase } from "../core/phrases.ts";
import { importGedcom, importStromJson, isStromJson, type ImportResult } from "../core/import.ts";
import { decodeText, safeFolderName } from "../core/text.ts";
import type { Tree } from "../core/tree.ts";
import { amendInput, checkOriginalMeta } from "../core/originals.ts";
import { batchStatus, closeBatch, listBatches, readBatch } from "../core/batches.ts";
import { SORT_KINDS, type Source } from "../core/model.ts";
import { actsAsArchive } from "../core/state.ts";
import { isArchive } from "../core/mode.ts";
import { ui } from "../cli/ui.ts";
import { fileBy, handFiles, taskForFile, taskPeople } from "../core/taskfiles.ts";

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

/** The research the inputs are for: the one named, else the only active one. */
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
      // Files per argument: a folder becomes one intake task, not one per file.
      const groups = args.map((a) => {
        const p = ctx.resolvePath(a);
        if (!fs.existsSync(p)) throw notFound(a);
        const folder = fs.statSync(p).isDirectory();
        const files = collectFiles([p]);
        const images = files.filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase())).length;
        if (folder && images > BOOK_OF_SCANS && !opts.documents)
          throw new UsageError(`${images} images in ${ctx.display(p)} look like the scans of a book, not family documents`, {
            hint: `scans of a register: strom recordset add "<the book>" … then strom media add "${a}" --recordset B…\nif they are family documents after all: strom intake "${a}" --documents`,
          });
        return { folder: folder ? path.basename(p) : undefined, files };
      });
      // where nobody researches (an archive, a research waiting for its agent): said to the person, in the research's
      // language — kept, no task to take next (an archive's waits put aside until research is switched on)
      const quiet = actsAsArchive(tree);
      const known = new Map(tree.list<Input>("input").filter((i) => i.sha).map((i) => [i.sha!, i.id]));
      const report: string[] = [];
      const added: Input[] = [];
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
            continue;
          }
          const size = fs.statSync(file).size;
          const isText = size < 50 * 1024 * 1024 && [".ged", ".json", ".txt", ".md", ".csv"].includes(path.extname(file).toLowerCase());
          // as whatever saved it: a BOM (Notepad, PowerShell 5) or UTF-16 is still the same family tree
          const text = isText ? decodeText(fs.readFileSync(file)) : undefined;
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
              ? importGedcom(tree, text, { input: input.id, name: input.name, sha })
              : importStromJson(tree, JSON.parse(text), { input: input.id, name: input.name });
            update<Input>(tree, input.id, "input", (i) => ({ ...i, source: imported!.source, imported: { persons: imported!.persons, families: imported!.families, sources: 1 } }), {
              op: "input.imported",
              summary: `${input.id} imported: ${imported.persons} persons, ${imported.families} families${imported.matched ? `, ${imported.matched} matched` : ""}`,
            });
            const back = imported.matched && imported.matched >= imported.persons;
            if (quiet) {
              // where nobody researches the person reads it, in the research's language: the tree is in it (no review talk)
              report.push(`  ${ui(tree.lang, "ui.intake.tree", { id: input.id, persons: imported.persons, families: imported.families, events: imported.events, source: imported.source })}${imported.matched ? ui(tree.lang, "ui.intake.tree.matched", { n: imported.matched }) : ""}`);
              if (back) report.push(`  ${ui(tree.lang, "ui.intake.tree.back", { file: ctx.display(file) })}`);
            } else {
              report.push(`  ${input.id} tree: ${imported.persons} persons, ${imported.families} families, ${imported.events} facts as leads${imported.matched ? `, ${imported.matched} matched to existing` : ""}${imported.problems.length ? ` (${imported.problems.length} unreadable lines)` : ""}`);
              if (imported.extended.length) report.push(`  added to what we have (leads — check them): ${imported.extended.slice(0, 6).join(" · ")}${imported.extended.length > 6 ? " …" : ""}`);
              // the research's own tree coming back: sync sees what was changed in it too, not only what was added
              if (back) report.push(`  it is this research's tree coming back: strom sync "${ctx.display(file)}" shows what was changed in it too`);
              const system = `gedcom:${sha.slice(0, 12)}`;
              const dupes = likelyDuplicates(tree, tree.list<Person>("person").filter((p) => p.refs?.some((r) => r.system === system)).map((p) => p.id));
              if (dupes.length) report.push(`  probably already in the tree: ${dupes.map((d) => `${d.person.id}≈${d.same.id}`).join(", ")} (the review task lists them)`);
            }
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
      const text = lines(
        quiet
          ? added.length
            ? `${ui(tree.lang, isArchive(tree) ? "ui.intake.done.archive" : "ui.intake.done.waiting", { n: added.length })}${skipped ? ` ${ui(tree.lang, "ui.intake.same", { n: skipped })}` : ""}`
            : ui(tree.lang, "ui.intake.known")
          : `${added.length} input(s) registered${skipped ? `, ${skipped} already known (same content)` : ""}`,
        added.length ? table(added.map((i) => [`  ${i.id}`, i.kind, truncate(i.name, 60)])) : undefined,
        ...report,
        !quiet && tree.written.some((o) => o.op === "task.add") ? `\n${tree.written.filter((o) => o.op === "task.add").length} intake task(s) created → strom task next` : undefined,
        task ? `${task.id} got ${[...new Set(handed)].join(", ")} and is back in the queue — the file is read as its next step (no intake task)` : undefined,
      );
      return { text, data: { inputs: added, skipped, ...(task ? { task: task.id, handed: [...new Set(handed)], state: task.state } : {}) } };
    },
  },
  {
    path: ["input", "list"],
    summary: "Inputs of this tree and their state",
    group: "inputs",
    tree: true,
    options: [{ name: "state", type: "string", value: "<state>", description: "new, processed or skipped" }, { name: "full", type: "boolean", description: "--json: whole records instead of one row each" }],
    run(ctx, { opts }) {
      const all = ctx.tree().list<Input>("input").filter((i) => !opts.state || i.state === opts.state);
      const page = paginate(all, ctx.limit, ctx.page);
      return {
        text: all.length ? lines(table(page.items.map((i) => [i.id, i.kind, i.state, truncate(i.name, 60)])), moreLine(page, "strom input list")) : 'no inputs → strom intake <files or folder>',
        data: { total: all.length, inputs: opts.full ? page.items : page.items.map((i) => ({ id: i.id, kind: i.kind, state: i.state, name: i.name })) },
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
      const abs = inputPath(tree, i);
      const tasks = tree.list<Task>("task").filter((t) => t.where.includes(i.id));
      const text = lines(
        `${i.id} ${i.name}  [${i.kind} · ${i.state}]`,
        abs ? `file   ${abs}` : undefined,
        i.from ? `from   ${i.from}` : undefined,
        i.batch ? `batch  ${i.batch}${i.path ? ` · ${i.path}` : ""}` : undefined,
        i.persons?.length ? `of     ${i.persons.join(", ")}` : undefined,
        i.sorted ? `sorted ${i.sorted.as}${i.sorted.source ? ` → ${i.sorted.source}` : ""}${i.sorted.reason ? ` (${i.sorted.reason})` : ""}` : undefined,
        i.mime ? `type   ${i.mime}${i.size !== undefined ? ` · ${Math.round(i.size / 1024)} kB` : ""}` : undefined,
        i.imported ? `import ${i.imported.persons} persons, ${i.imported.families} families as leads, cited as ${i.source}` : undefined,
        i.text ? `\n${i.text}` : undefined,
        !i.text && i.kind === "text" && abs && fs.existsSync(abs) && (i.size ?? 0) < 20_000 && /\.(txt|md|csv)$/i.test(abs) ? `\n${fs.readFileSync(abs, "utf8").trim()}` : undefined,
        tasks.length ? `\ntasks\n${table(tasks.map((t) => [`  ${t.id}`, t.state, truncate(t.what, 60)]))}` : undefined,
        ...i.notes.map((n) => `note   ${n.text}`),
        i.kind === "document" && abs
          ? `\nread the file (a big image: strom media view ${i.id} --grid, then --crop), then record what it says: strom source add … --input ${i.id}`
          : undefined,
      );
      return { text, data: { input: i, path: abs, tasks: tasks.map((t) => t.id) } };
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
      update<Input>(tree, id, "input", (i) => ({ ...i, state: "skipped" }), { op: "input.skip", summary: `${id} skipped`, reason: String(opts.reason) });
      return { text: lines(...tree.written.map((o) => o.summary)), data: { id } };
    },
  },
  {
    path: ["input", "amend"],
    summary: "Add to an input what is said of it again: the people it is of, the user's note (the bridge runs it when the Strom app sends a file the research has)",
    group: "inputs",
    tree: true,
    writes: true,
    description:
      "Only what the input lacks is added: the people not named yet, a note not given yet. When something came and no task\n" +
      "at hand holds the input, an intake task looks at it again (in an archive put aside). Nothing new: nothing written.",
    args: [{ name: "input", description: "input ID", required: true }],
    options: [
      { name: "person", type: "string", multiple: true, value: "<P…>", description: "a person it is of (repeatable)" },
      { name: "note", type: "string", value: "<text>", description: "what the user said of it" },
    ],
    examples: ["strom input amend I0002 --person P0001 --note \"<what the user said of it>\""],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const id = normId(args[0]!, "input");
      const persons = (Array.isArray(opts.person) ? opts.person : opts.person ? [opts.person] : []).flatMap((p) => String(p).split(",")).map((p) => p.trim().toUpperCase()).filter(Boolean);
      const got = tree.withTreeLock(() => amendInput(tree, id, { persons, note: typeof opts.note === "string" ? opts.note : undefined }));
      return { text: tree.written.length ? lines(...tree.written.map((o) => o.summary)) : `${id}: nothing new`, data: got };
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
      return { text: lines(...tree.written.map((o) => o.summary), `${b.inputs.length} file(s) taken, ${b.known.length} known already, ${b.refused.length} refused — ${b.tasks.length} task(s) to sort them`), data };
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
    ],
    examples: ["strom input sort I0001 I0002 --as photo --person P0001", 'strom input sort I0003 --as unrelated --reason "a tax form of 1998"'],
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
              ...(as === "unrelated" ? { state: "skipped" as const } : {}),
              sorted: { as: as as (typeof SORT_KINDS)[number], ...(persons.length ? { persons } : {}), ...(source ? { source } : {}), ...(reason ? { reason } : {}), at: new Date().toISOString(), by: tree.actor },
            }),
            { op: "input.sort", summary: `${id} ${as}${persons.length ? ` of ${persons.join(", ")}` : ""}${source ? ` → ${source}` : ""}`, ...(reason ? { reason } : {}), targets: persons },
          );
      });
      return { text: lines(...tree.written.map((o) => o.summary)), data: { inputs: ids, as } };
    },
  },
);
