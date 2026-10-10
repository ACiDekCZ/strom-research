// strom grep: a text in the research's own files (inputs/, notes/, output/) — each line where it stands, with the
// lines round it. Big inputs (an old research's protocols, a transcribed register) are searched in one call, never
// read in pieces (core/grep.ts).

import { register } from "../cli/registry.ts";
import { lines, moreLine, paginate, shellArg } from "../cli/format.ts";
import { UsageError } from "../core/errors.ts";
import type { Input } from "../core/model.ts";
import { listOpt, requireRecord } from "../core/records.ts";
import { GREP_DEFAULT, GREP_FOLDERS, GREP_MAX_HITS, grepFiles, grepLines, grepMatcher, grepTargets } from "../core/grep.ts";
import { foldText } from "../core/text.ts";

const MAX_CONTEXT = 20;

register({
  path: ["grep"],
  summary: "Find a text in the research's own files (inputs/, notes/, output/): each line with its file and number",
  group: "analysis",
  tree: true,
  sheet: "never Read inputs/ or notes/ in pieces",
  description:
    "Searches the text files of inputs/ and notes/ (output/ too with --in output or --in all) — never data/ (the\n" +
    "records: strom find), .git or anything outside the tree, never through a symbolic link; images, PDFs and other\n" +
    "binary files are left out. A text is found as it reads: in any case, with accents or without (mlynar finds\n" +
    "Mlynář), a run of spaces as one. Several texts: a line with ANY of them (spellings of one name) by default;\n" +
    "--all: a line with EVERY one of them, in any order (a year and a name: 1803 \"Pag. 11\"). --regex: a\n" +
    "JavaScript regular expression, in any case, Unicode (\\p{L} a letter of any script). A line found is shown\n" +
    "file:line: text, a line round it (--context) file-line- text; a long line is cut round its find.\n" +
    `Listings are paged (--limit, --page); the search stops at ${GREP_MAX_HITS} lines and says so.`,
  args: [{ name: "text", description: "what to find (accents and capitals optional); several = a line with any of them (--all: with every one)", required: true, variadic: true }],
  options: [
    {
      name: "in",
      type: "string",
      multiple: true,
      value: "<where>",
      description: `${GREP_FOLDERS.join(" | ")} | all | a file or folder inside them | an input I… (default: ${GREP_DEFAULT.join(" and ")})`,
    },
    { name: "context", type: "string", value: "<n>", description: `lines shown before and after each line found (0–${MAX_CONTEXT}, default 0)` },
    { name: "all", type: "boolean", description: "several texts: a line with every one of them (default: with any)" },
    { name: "regex", type: "boolean", description: "the text is a regular expression (JavaScript, in any case, Unicode)" },
    { name: "files", type: "boolean", description: "only the files and how many lines each has found" },
  ],
  examples: [
    'strom grep "mlynář"',
    "strom grep Novák Nowak --in inputs --context 2",
    'strom grep 1803 "Pag. 11" --all --in I0002',
    'strom grep "Lhota" --in inputs/rodokmen.md --context 3',
    'strom grep "Nov[aá]k(ov[aá])?" --regex --in notes',
    "strom grep Novák --in I0002 --files",
  ],
  run(ctx, { args, opts }) {
    const tree = ctx.tree();
    const patterns = [...new Set(args.map((a) => a.trim()).filter(Boolean))];
    const regex = !!opts.regex;
    if (!patterns.length || (!regex && !patterns.some((p) => foldText(p)))) throw new UsageError("what to find?", { hint: 'strom grep "<text>"' });
    const context = opts.context === undefined ? 0 : Number(opts.context);
    if (!Number.isInteger(context) || context < 0 || context > MAX_CONTEXT) throw new UsageError(`--context: a number of lines, 0–${MAX_CONTEXT}`);
    // an input named by its ID: its file in inputs/ (one kept in the shared store is an image or a document)
    const wanted = listOpt(opts.in).map((w) => {
      if (!/^I\p{N}+$/iu.test(w)) return w;
      const input = requireRecord<Input>(tree, w, "input");
      if (!input.file?.startsWith("inputs/")) throw new UsageError(`${input.id} has no file in inputs/ to search`, { hint: `strom input show ${input.id}` });
      return input.file;
    });
    const { targets, error } = grepTargets(tree.root, wanted);
    if (error) throw new UsageError(error, { hint: `strom grep ${patterns.map(shellArg).join(" ")} --in ${GREP_FOLDERS.join("|")}|all` });
    let match: (line: string) => number;
    try {
      match = grepMatcher(patterns, regex, !!opts.all);
    } catch (e) {
      throw new UsageError(`not a regular expression: ${(e as Error).message}`, { hint: "strom grep <text> — without --regex the text is found as it reads" });
    }
    const found = grepFiles(tree.root, targets, match, context);
    const where = (wanted.length ? wanted : GREP_DEFAULT).map((w) => (/[/.]/u.test(w) || w === "all" ? w : `${w}/`)).join(", ");
    const again = [
      "strom grep",
      ...patterns.map(shellArg),
      ...wanted.map((w) => `--in ${shellArg(w)}`),
      ...(context ? [`--context ${context}`] : []),
      ...(regex ? ["--regex"] : []),
      ...(opts.all ? ["--all"] : []),
      ...(opts.files ? ["--files"] : []),
    ].join(" ");
    const tooBig = found.tooBig.length ? `left out, over 64 MB: ${found.tooBig.join(", ")}` : undefined;
    if (!found.hits.length)
      return {
        text: lines(`not found in ${found.searched} text file(s) of ${where}`, tooBig, "→ the records: strom find <text>"),
        data: { total: 0, searched: found.searched, hits: [], ...(found.tooBig.length ? { tooBig: found.tooBig } : {}) },
      };
    const total = `${found.hits.length}${found.capped ? "+" : ""}`;
    // several texts: whether a line has any or every one of them, said (agents expect every one)
    const mode = patterns.length > 1 ? (opts.all ? " with every text" : " with any of the texts (every one: --all)") : "";
    const head = `${total} line(s)${mode} in ${found.counts.size} of ${found.searched} text file(s) of ${where}${found.capped ? ` — stopped at ${GREP_MAX_HITS}: a narrower text or --in` : ""}`;
    if (opts.files) {
      const files = [...found.counts].map(([file, n]) => ({ file, lines: n }));
      const page = paginate(files, ctx.limit, ctx.page);
      return {
        text: lines(head + ":", ...page.items.map((f) => `${f.file}: ${f.lines}`), moreLine(page, again) || undefined, tooBig),
        data: { total: found.hits.length, capped: found.capped, searched: found.searched, files: page.items, ...(found.tooBig.length ? { tooBig: found.tooBig } : {}) },
      };
    }
    const page = paginate(found.hits, ctx.limit, ctx.page);
    return {
      text: lines(head + ":", ...grepLines(page.items), moreLine(page, again) || undefined, tooBig),
      data: { total: found.hits.length, capped: found.capped, searched: found.searched, files: found.counts.size, hits: page.items, ...(found.tooBig.length ? { tooBig: found.tooBig } : {}) },
    };
  },
});
