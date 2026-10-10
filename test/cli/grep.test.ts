// strom grep: a text in the research's own files — inputs/ and notes/ (output/ when asked), never data/, .git, .strom,
// nothing outside the tree and nothing through a symbolic link. Found as it reads (case, accents, NFC/NFD, any script),
// or a regular expression; lines with their file and number, the lines round them, capped and paged. Found in a live
// run: a delegate read three big inputs in 110 pieces for want of a search (3.83 USD).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { grepLines, shownLine } from "../../src/core/grep.ts";

const opts = { skip: !hasGit };

async function tree(): Promise<World> {
  const w = new World();
  await w.withTree();
  const big = Array.from({ length: 3000 }, (_, i) => `řádek ${i + 1}: nic`);
  big[1499] = "1782 křest: Jan Mlynář, syn Václava, Lhota čp. 12";
  big[2499] = "1790 pohřeb: Anna MLYNÁŘOVÁ, Lhota";
  fs.writeFileSync(path.join(w.cwd, "inputs", "protokol.md"), big.join("\n") + "\n");
  // decomposed (NFD) letters, as a file from macOS may hold them; Windows line ends
  fs.writeFileSync(path.join(w.cwd, "inputs", "zdroje.txt"), ["Matrika Lhota 1780–1800", "kmotr: Josef Mlynář".normalize("NFD"), "Шевчук Іван, 1801"].join("\r\n"));
  fs.mkdirSync(path.join(w.cwd, "notes", "readings"), { recursive: true });
  fs.writeFileSync(path.join(w.cwd, "notes", "readings", "B0001.md"), "image 57: nothing\nimage 58: Mlynar? unclear\n");
  fs.writeFileSync(path.join(w.cwd, "output", "tree.ged"), "0 HEAD\n1 NAME Jan /Mlynář/\n");
  // what is never searched: an image, strom's own folder, the records, a file outside reached by a link
  fs.writeFileSync(path.join(w.cwd, "inputs", "scan.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0x00, ...Buffer.from("Mlynář")]));
  fs.mkdirSync(path.join(w.cwd, ".strom"), { recursive: true });
  fs.writeFileSync(path.join(w.cwd, ".strom", "secret.md"), "Mlynář in .strom\n");
  fs.writeFileSync(path.join(w.dir, "outside.md"), "Mlynář outside\n");
  try {
    fs.symlinkSync(path.join(w.dir, "outside.md"), path.join(w.cwd, "inputs", "link.md"));
    fs.symlinkSync(w.dir, path.join(w.cwd, "notes", "away"));
  } catch {
    // no symbolic links here (Windows without the right): nothing to leave out
  }
  return w;
}

test("strom grep finds a text as it reads in inputs/ and notes/: any case, without accents, NFD, any script", opts, async () => {
  const w = await tree();
  const r = await w.ok(["grep", "mlynar"]);
  assert.match(r.out, /^4 line\(s\) in 3 of 3 text file\(s\) of inputs\/, notes\/:/u);
  assert.match(r.out, /\ninputs\/protokol\.md:1500: 1782 křest: Jan Mlynář, syn Václava, Lhota čp\. 12\n/u);
  assert.match(r.out, /\ninputs\/protokol\.md:2500: 1790 pohřeb: Anna MLYNÁŘOVÁ, Lhota\n/u);
  // shown composed (NFC), the Windows line end gone
  assert.match(r.out, /\ninputs\/zdroje\.txt:2: kmotr: Josef Mlynář\n/u);
  assert.match(r.out, /\nnotes\/readings\/B0001\.md:2: image 58: Mlynar\? unclear/u);
  // never output/ unasked, never data/, .strom, an image, nor anything a symbolic link leads to
  assert.doesNotMatch(r.out, /tree\.ged|in data|in \.strom|outside|scan\.jpg|link\.md|away/u);
  // a pattern typed decomposed, with capitals, finds the same
  assert.equal((await w.ok(["grep", "MLYNÁŘ".normalize("NFD"), "--json"])).json.total, 4);
  // another script
  assert.match((await w.ok(["grep", "шевчук"])).out, /inputs\/zdroje\.txt:3: Шевчук Іван, 1801/u);
  w.cleanup();
});

test("strom grep: several texts, --context, --regex, --files, --in a folder, a file, an input, all", opts, async () => {
  const w = await tree();
  // several texts: a line with any of them
  assert.equal((await w.ok(["grep", "Шевчук", "pohřeb", "--json"])).json.total, 2);
  // the lines round a find, grep's way; stretches apart split by --
  const c = await w.ok(["grep", "lhota", "--in", "inputs/protokol.md", "--context", "1"]);
  assert.match(c.out, /\ninputs\/protokol\.md-1499- řádek 1499: nic\ninputs\/protokol\.md:1500: 1782 křest[^\n]*\ninputs\/protokol\.md-1501- řádek 1501: nic\n--\ninputs\/protokol\.md-2499- /u);
  const j = (await w.ok(["grep", "lhota", "--in", "inputs/protokol.md", "--context", "2", "--json"])).json;
  assert.deepEqual(j.hits[0].before.map((l: any) => l.line), [1498, 1499]);
  assert.equal(j.hits[0].after[1].text, "řádek 1502: nic");
  // a regular expression, in any case, Unicode
  const re = await w.ok(["grep", "mlyn[aá]ř(ov[aá])?", "--regex", "--json"]);
  assert.equal(re.json.total, 3);
  assert.equal((await w.ok(["grep", "^\\p{Lu}\\p{Ll}+ \\p{Lu}", "--regex", "--in", "inputs/zdroje.txt", "--json"])).json.total, 2);
  // only the files
  assert.match((await w.ok(["grep", "mlynar", "--files"])).out, /\ninputs\/protokol\.md: 2\ninputs\/zdroje\.txt: 1\nnotes\/readings\/B0001\.md: 1/u);
  // output/ when asked; all of them
  assert.match((await w.ok(["grep", "mlynar", "--in", "output"])).out, /output\/tree\.ged:2: 1 NAME Jan \/Mlynář\//u);
  assert.equal((await w.ok(["grep", "mlynar", "--in", "all", "--json"])).json.total, 5);
  // an input by its ID: its file
  await w.ok(["intake", "--text", "Rodina z Lhoty"]);
  const file = path.join(w.cwd, "inputs", "dopis.txt");
  fs.writeFileSync(file, "Milá rodino,\nJosef Mlynář psal z Lhoty.\n");
  await w.ok(["intake", file]);
  const inputs = (await w.ok(["input", "list", "--json", "--full"])).json.inputs;
  const letter = inputs.find((i: any) => i.file?.startsWith("inputs/") && i.file.endsWith("dopis.txt"));
  assert.ok(letter, JSON.stringify(inputs));
  const one = await w.ok(["grep", "mlynar", "--in", letter.id]);
  assert.match(one.out, new RegExp(`^1 line\\(s\\) in 1 of 1 text file\\(s\\) of ${letter.file.replace(/[.]/g, "\\.")}:\\n${letter.file.replace(/[.]/g, "\\.")}:2: Josef Mlynář psal z Lhoty\\.`, "u"));
  const textOnly = inputs.find((i: any) => !i.file);
  if (textOnly) assert.equal((await w.run(["grep", "x", "--in", textOnly.id])).code, 2);
  w.cleanup();
});

test("strom grep refuses what is not the research's text: data/, .strom, .git, outside, a symbolic link, a bad pattern", opts, async () => {
  const w = await tree();
  fs.writeFileSync(path.join(w.cwd, "data", "x.md"), "Mlynář in data\n");
  assert.doesNotMatch((await w.ok(["grep", "mlynar", "--in", "all"])).out, /Mlynář in data/u);
  for (const where of ["data", ".strom", ".git", "../outside.md", "inputs/../data", path.join(w.dir, "outside.md"), "strom.json"]) {
    const r = await w.run(["grep", "mlynar", "--in", where]);
    assert.equal(r.code, 2, `${where}: ${r.out}${r.err}`);
    assert.doesNotMatch(r.out + r.err, /Mlynář (in data|outside|in \.strom)/u, where);
  }
  if (fs.existsSync(path.join(w.cwd, "inputs", "link.md"))) {
    const r = await w.run(["grep", "mlynar", "--in", "inputs/link.md"]);
    assert.equal(r.code, 2);
    assert.match(r.err + r.out, /symbolic link/u);
    assert.equal((await w.run(["grep", "mlynar", "--in", "notes/away/outside.md"])).code, 2);
  }
  assert.equal((await w.run(["grep", "(", "--regex"])).code, 2);
  assert.equal((await w.run(["grep", "x", "--context", "99"])).code, 2);
  assert.equal((await w.run(["grep", "   "])).code, 2);
  // nothing found: said, with the way to the records
  const none = await w.ok(["grep", "nikde-nic"]);
  assert.match(none.out, /^not found in 3 text file\(s\) of inputs\/, notes\/\n→ the records: strom find <text>/u);
  w.cleanup();
});

test("strom grep pages its lines and cuts a long line round its find", opts, async () => {
  const w = await tree();
  const r = await w.ok(["grep", "nic", "--in", "inputs/protokol.md", "--limit", "5"]);
  assert.match(r.out, /^2998 line\(s\) in 1 of 1 text file\(s\) of inputs\/protokol\.md:\n/u);
  assert.match(r.out, /\n… 2993 more: strom grep nic --in inputs\/protokol\.md --page 2\n$/u);
  assert.equal(r.out.split("\n").filter((l) => l.startsWith("inputs/")).length, 5);
  const long = "x".repeat(1000) + " Mlynář " + "y".repeat(1000);
  fs.writeFileSync(path.join(w.cwd, "notes", "long.md"), long + "\n");
  const l = await w.ok(["grep", "mlynar", "--in", "notes/long.md"]);
  const line = l.out.split("\n")[1]!;
  assert.match(line, /^notes\/long\.md:1: …x+ Mlynář y+…$/u);
  assert.ok(line.length < 300, String(line.length));
  w.cleanup();
});

test("strom grep is told everywhere an agent learns: the catalog, the guide, AGENTS.md, the delegates' sheet, the scan reader", opts, async () => {
  const w = new World();
  await w.withTree();
  const catalog = (await w.ok(["commands", "--json"])).json;
  const all = JSON.stringify(catalog);
  assert.match(all, /"grep"/u);
  assert.match((await w.ok(["guide"])).out, /strom grep <text> \[--in inputs\|notes\|output\|I…\] \[--context 2\]\n\s+a text in the research's own files/u);
  assert.match(fs.readFileSync(path.join(w.cwd, "AGENTS.md"), "utf8"), /A text in those files: `strom grep "<text>"` \(each line with its file and\n {3}number\) — never read a big file in pieces\./u);
  // Claude Code: a range to strom read, a delegate only for crops; a delegate of the general kind gets the sheet
  const claude = fs.readFileSync(path.join(w.cwd, "CLAUDE.md"), "utf8");
  assert.match(claude, /goes to `strom read` \(by halves: `--half both`\); a delegate reads only crops\n {2}of the entries found\./u);
  assert.match(claude, /A delegate other than strom-scan-reader \(text, print, a search\) gets no brief:\n {2}begin its prompt with this, word for word — "A family research kept with strom: you read and report, you never write to it\. Run each `strom …` command on its own — no pipes, `;`, `&&`, `\$\(…\)`, variables, awk or any other program: they are refused\. Read opens inputs\/, notes\/, output\/ and \.strom\/views\/ only, never data\/\. A text in those files: `strom grep "<text>" \[--in inputs\|notes\|I…\] \[--context 2\]` — never Read a big file in pieces\."/u);
  assert.match(claude, /\| a text in inputs\/ or notes\/ \| nobody — `strom grep`, one call \|/u);
  assert.doesNotMatch(claude, /a plain grep/u);
  const reader = fs.readFileSync(path.join(w.cwd, ".claude", "agents", "strom-scan-reader.md"), "utf8");
  assert.match(reader, /A text in\nthe research's files \(inputs\/, notes\/\): `strom grep "<text>"` — never Read a big file in pieces\./u);
  // run by the rule every strom command has
  assert.ok(JSON.parse(fs.readFileSync(path.join(w.cwd, ".claude", "settings.json"), "utf8")).permissions.allow.includes("Bash(strom:*)"));
  w.cleanup();
});

test("grep's lines: a line round two finds shown once, a find inside another's context marked as found", () => {
  const out = grepLines([
    { file: "a.md", line: 2, text: "two", before: [{ line: 1, text: "one" }], after: [{ line: 3, text: "three" }] },
    { file: "a.md", line: 3, text: "three", before: [{ line: 2, text: "two" }], after: [{ line: 4, text: "four" }] },
    { file: "b.md", line: 9, text: "nine", before: [], after: [] },
  ]);
  assert.deepEqual(out, ["a.md-1- one", "a.md:2: two", "a.md:3: three", "a.md-4- four", "--", "b.md:9: nine"]);
  assert.equal(shownLine("short", 0), "short");
  // never inside a letter: characters, not UTF-16 units
  const emoji = "😀".repeat(300);
  assert.ok(!/�/u.test(shownLine(emoji, 400)));
});
