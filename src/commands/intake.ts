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
import { UsageError } from "../core/errors.ts";
import type { Input, Person, Research, Task } from "../core/model.ts";
import { likelyDuplicates } from "../core/people.ts";
import { collectFiles, fileSha256, inputPath, MAX_IN_TREE, mimeOf, storeShared } from "../core/media.ts";
import { create, normId, requireRecord, update } from "../core/records.ts";
import { phrase } from "../core/phrases.ts";
import { importGedcom, importStromJson, isStromJson, type ImportResult } from "../core/import.ts";
import { safeFolderName } from "../core/text.ts";
import type { Tree } from "../core/tree.ts";

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

function intakeTask(tree: Tree, input: Input, research: string | undefined, imported?: ImportResult): Task {
  return groupTask(tree, [input], research, imported);
}

/** One intake task for the inputs of one folder (or one file, or one text). */
function groupTask(tree: Tree, inputs: Input[], research: string | undefined, imported?: ImportResult, folder?: string): Task {
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
    { level: "intake", priority: 4, what, where: ids, why, doneWhen, subject: ids, research, state: "open", origin: tree.actor },
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
      "Family trees are imported at once — every person and fact as a lead citing that tree.",
    args: [{ name: "paths", description: "files or folders", variadic: true }],
    options: [
      { name: "text", type: "string", value: "<text>", description: "what the user tells you, as an input of its own" },
      { name: "no-import", type: "boolean", description: "register trees without importing them" },
      { name: "documents", type: "boolean", description: `a folder with more than ${BOOK_OF_SCANS} images really is family documents (not scans of a book)` },
      { name: "research", type: "string", value: "<G…>", description: "the research it is for (default: the only active one)" },
    ],
    examples: ['strom intake ~/Downloads/rodina', "strom intake strom-export.json", 'strom intake --text "Děda Jan, narozen asi 1905 v Týnci, byl mlynář"', "strom intake ~/Downloads/rodina/dopis.txt --research G0001"],
    run(ctx: Context, { args, opts }) {
      const tree = ctx.tree();
      if (args.length === 0 && !opts.text) throw new UsageError("give files/folders or --text");
      const research = researchFor(tree, opts.research);
      // Files per argument: a folder becomes one intake task, not one per file.
      const groups = args.map((a) => {
        const p = ctx.resolvePath(a);
        if (!fs.existsSync(p)) throw new UsageError(`no such file or folder: ${a}`);
        const folder = fs.statSync(p).isDirectory();
        const files = collectFiles([p]);
        const images = files.filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase())).length;
        if (folder && images > BOOK_OF_SCANS && !opts.documents)
          throw new UsageError(`${images} images in ${ctx.display(p)} look like the scans of a book, not family documents`, {
            hint: `scans of a register: strom recordset add "<the book>" … then strom media add "${a}" --recordset B…\nif they are family documents after all: strom intake "${a}" --documents`,
          });
        return { folder: folder ? path.basename(p) : undefined, files };
      });
      const known = new Set(tree.list<Input>("input").map((i) => i.sha).filter(Boolean));
      const report: string[] = [];
      const added: Input[] = [];
      let skipped = 0;
      tree.withTreeLock(() => {
        for (const group of groups) {
        const plain: Input[] = [];
        for (const file of group.files) {
          const sha = fileSha256(file);
          if (known.has(sha)) {
            skipped++;
            continue;
          }
          known.add(sha);
          const size = fs.statSync(file).size;
          const isText = size < 50 * 1024 * 1024 && [".ged", ".json", ".txt", ".md", ".csv"].includes(path.extname(file).toLowerCase());
          const text = isText ? fs.readFileSync(file, "utf8") : undefined;
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
            { name: path.basename(file), file: stored, sha, size, mime: mimeOf(file), from: ctx.display(file), kind, state: "new" },
            (iid) => `+${iid} input ${kind} "${truncate(path.basename(file), 50)}"`,
          );
          let imported: ImportResult | undefined;
          if (kind === "tree" && !opts["no-import"] && text !== undefined) {
            imported = path.extname(file).toLowerCase() === ".ged"
              ? importGedcom(tree, text, { input: input.id, name: input.name, sha })
              : importStromJson(tree, JSON.parse(text), { input: input.id, name: input.name });
            update<Input>(tree, input.id, "input", (i) => ({ ...i, source: imported!.source, imported: { persons: imported!.persons, families: imported!.families, sources: 1 } }), {
              op: "input.imported",
              summary: `${input.id} imported: ${imported.persons} persons, ${imported.families} families${imported.matched ? `, ${imported.matched} matched` : ""}`,
            });
            report.push(`  ${input.id} tree: ${imported.persons} persons, ${imported.families} families, ${imported.events} facts as leads${imported.matched ? `, ${imported.matched} matched to existing` : ""}${imported.problems.length ? ` (${imported.problems.length} unreadable lines)` : ""}`);
            if (imported.extended.length) report.push(`  added to what we have (leads — check them): ${imported.extended.slice(0, 6).join(" · ")}${imported.extended.length > 6 ? " …" : ""}`);
            const system = `gedcom:${sha.slice(0, 12)}`;
            const dupes = likelyDuplicates(tree, tree.list<Person>("person").filter((p) => p.refs?.some((r) => r.system === system)).map((p) => p.id));
            if (dupes.length) report.push(`  probably already in the tree: ${dupes.map((d) => `${d.person.id}≈${d.same.id}`).join(", ")} (the review task lists them)`);
          }
          // A family tree gets its own review task; the other files of a folder share one.
          if (kind === "tree" || !group.folder) intakeTask(tree, input, research, imported);
          else plain.push(input);
          added.push(input);
        }
        if (plain.length) groupTask(tree, plain, research, undefined, group.folder);
        }
        if (typeof opts.text === "string" && opts.text.trim()) {
          const input = create<Input>(tree, "input", { name: truncate(opts.text, 60), text: opts.text.trim(), kind: "text", state: "new", from: "user" }, (iid) => `+${iid} input text`);
          intakeTask(tree, input, research);
          added.push(input);
        }
      });
      const text = lines(
        `${added.length} input(s) registered${skipped ? `, ${skipped} already known (same content)` : ""}${tree.dryRun ? " (dry run)" : ""}`,
        added.length ? table(added.map((i) => [`  ${i.id}`, i.kind, truncate(i.name, 60)])) : undefined,
        ...report,
        tree.written.some((o) => o.op === "task.add") ? `\n${tree.written.filter((o) => o.op === "task.add").length} intake task(s) created → strom task next` : undefined,
      );
      return { text, data: { inputs: added, skipped } };
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
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      if (!opts.reason) throw new UsageError("--reason is required");
      const id = normId(args[0]!, "input");
      update<Input>(tree, id, "input", (i) => ({ ...i, state: "skipped" }), { op: "input.skip", summary: `${id} skipped`, reason: String(opts.reason) });
      return { text: lines(...tree.written.map((o) => o.summary)), data: { id } };
    },
  },
);
