// A sort of the material (strom material sort) as Milan's sort of 50 files showed it on 18 Nov 2026: a text file (.txt,
// .md) read as text by its readers (its beginning, of a long one, said so), never judged by its name alone; how far the
// sort is while at work (filesDone: the files whose readers ended); every file with no proposal says why (unproposed);
// the readers' own folders in the shared cache cleared as they end, those left behind long ago swept.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { World, hasGit, until } from "../helpers.ts";
import { encodeImage } from "../../src/image/index.ts";
import { isTextFile, keptProposals, loadSort, parseSortReport, sortForApp, textOfFile, unproposedOf, SORT_TEXT_FILE_MAX } from "../../src/core/sort.ts";
import { READER_ROOM_KEEP_MS, sweepReaderRooms } from "../../src/commands/readers.ts";
import { Tree } from "../../src/core/tree.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "strom-sort-text-"));

test("a text file read as text: UTF-8 in NFC, its mark of UTF-8 or UTF-16 taken off, a single-byte text as Windows-1252; a long one cut, never half a character", () => {
  const dir = tmp();
  const write = (name: string, data: string | Buffer) => {
    const p = path.join(dir, name);
    fs.writeFileSync(p, data);
    return p;
  };
  const said = "Milá Evo, Лгота 1932 — 祖父 👨‍👩‍👧".normalize("NFD");
  assert.deepEqual(textOfFile(write("a.txt", said)), { text: said.normalize("NFC"), chars: [...said.normalize("NFC")].length });
  assert.equal(textOfFile(write("b.md", Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("# Dopis", "utf8")]))).text, "# Dopis");
  assert.equal(textOfFile(write("c.txt", Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("Žofie", "utf16le")]))).text, "Žofie");
  assert.equal(textOfFile(write("d.txt", Buffer.from([0x43, 0x61, 0x66, 0xe9]))).text, "Café", "not UTF-8: as Windows-1252");
  // a long one: its beginning, at most the limit, the cut never inside a character (an emoji across it)
  const long = "ž".repeat(SORT_TEXT_FILE_MAX - 1) + "😀" + "x".repeat(5000);
  const cut = textOfFile(write("e.txt", long));
  assert.equal(cut.chars, SORT_TEXT_FILE_MAX);
  assert.equal([...cut.text].length, SORT_TEXT_FILE_MAX);
  assert.ok(cut.text.endsWith("😀") && !/\p{Cs}/u.test(cut.text), "the emoji whole, no half of it");
  assert.equal(cut.cut?.bytes, Buffer.byteLength(long));
  // a large file: never read whole
  const big = textOfFile(write("f.txt", "a".repeat(5_000_000)), 100);
  assert.deepEqual([big.chars, big.cut?.bytes], [100, 5_000_000]);
  // which are texts: by the name's ending (any case, NFD), else the type
  assert.deepEqual(
    ["dopis.TXT", "Poznámky.md".normalize("NFD"), "x.markdown", "bez", "foto.jpg"].map((n) => isTextFile(n)),
    [true, true, true, false, false],
  );
  assert.equal(isTextFile("bez", "text/plain; charset=utf-8"), true);
  assert.equal(isTextFile("bez", "image/jpeg"), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a reader's block under any head it writes it with; every file with no proposal says why — nothing said, nothing new, dropped, left out, its reader failed", () => {
  const raw = parseSortReport(["## File: I1", "kind: photo", "## **File I2**", "why: Nic nečitelného.", "sure: low", "### I3 — dopis", "link: person P99", "## Soubor I4", "title: Svatba", "## File I6", "kind: photo"].join("\n"));
  assert.deepEqual(
    raw.map((r) => r.id),
    ["I0001", "I0002", "I0003", "I0004", "I0006"],
  );
  const tree = {
    get: (id: string) =>
      ({
        I0001: { id: "I0001", type: "input", name: "a.jpg" },
        I0002: { id: "I0002", type: "input", name: "b.jpg" },
        I0003: { id: "I0003", type: "input", name: "c.txt" },
        I0004: { id: "I0004", type: "input", name: "d.jpg" },
        I0005: { id: "I0005", type: "input", name: "e.jpg" },
        I0006: { id: "I0006", type: "input", name: "f.jpg", materialKind: "photo" },
        I0007: { id: "I0007", type: "input", name: "g.jpg" },
      })[id] as never,
  };
  const files = ["I0001", "I0002", "I0003", "I0004", "I0005", "I0006", "I0007"];
  const kept = keptProposals(tree, files, raw);
  assert.deepEqual(
    kept.proposals.map((p) => p.id),
    ["I0001", "I0004"],
  );
  const readers = [
    { n: 1, files: files.slice(0, 6), began: "x", ended: "y", outcome: "ok" },
    { n: 2, files: ["I0007"], began: "x", ended: "y", outcome: "timeout" },
  ];
  assert.deepEqual(unproposedOf(files, raw, kept, readers), [
    { id: "I0002", why: "nothing-said", said: "Nic nečitelného." },
    { id: "I0003", why: "dropped" },
    { id: "I0005", why: "left-out" },
    { id: "I0006", why: "nothing-new" },
    { id: "I0007", why: "reader-failed", outcome: "timeout" },
  ]);
});

test("the readers' own folders: those left unchanged two days swept, never the desk, a file or a fresh one", () => {
  const work = tmp();
  for (const n of ["desk", "old-1", "fresh-1"]) fs.mkdirSync(path.join(work, n));
  fs.writeFileSync(path.join(work, "old-file"), "x");
  const old = new Date(Date.now() - READER_ROOM_KEEP_MS - 60_000);
  for (const n of ["desk", "old-1", "old-file"]) fs.utimesSync(path.join(work, n), old, old);
  assert.equal(sweepReaderRooms(work), 1);
  assert.deepEqual(fs.readdirSync(work).sort(), ["desk", "fresh-1", "old-file"]);
  assert.equal(sweepReaderRooms(path.join(work, "none")), 0, "no cache: nothing");
  fs.rmSync(work, { recursive: true, force: true });
});

// the reader: writes the blocks of its own files (named in its prompt) from SORT_BODY; the one given SORT_HOLD_FOR waits
// while SORT_HOLD is there
const READER = `import fs from "node:fs";
const p = process.env.STROM_PROMPT ?? "";
const report = /Write your report to (.+) AS YOU GO/.exec(p)[1];
const mine = [...p.matchAll(/^- (I\\d+) · /gm)].map((m) => m[1]);
fs.appendFileSync(process.env.SORT_TOLD, p + "\\n=====\\n");
if (mine.includes(process.env.SORT_HOLD_FOR)) while (fs.existsSync(process.env.SORT_HOLD)) await new Promise((r) => setTimeout(r, 50));
const blocks = fs.readFileSync(process.env.SORT_BODY, "utf8").split(/(?=^## )/m).filter((b) => mine.some((id) => b.includes(id + "\\n")));
fs.writeFileSync(report, fs.readFileSync(report, "utf8").replace("<!-- next file block -->", blocks.join("").trim() + "\\n<!-- next file block -->"));
console.log("cost: 0.1");
`;

test("a sort of eleven files: the texts read as text, filesDone while at work, a file with no proposal says why, the readers' folders cleared", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M", "--born", "1890"]);
  const dir = path.join(w.dir, "třídění");
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, "reader.mjs"), READER);
  Object.assign(w.env, {
    STROM_AGENT: "script",
    STROM_RUNNER_SCRIPT: path.join(dir, "reader.mjs"),
    SORT_BODY: path.join(dir, "body.md"),
    SORT_TOLD: path.join(dir, "told.txt"),
    SORT_HOLD: path.join(dir, "hold"),
    STROM_NO_CONVERT: "1",
  });
  const box = path.join(w.dir, "krabice");
  fs.mkdirSync(box);
  const names: string[] = [];
  for (let k = 0; k < 9; k++) {
    const n = `foto-${k + 1}.jpg`;
    fs.writeFileSync(path.join(box, n), encodeImage({ width: 40, height: 30, channels: 3, data: new Uint8Array(40 * 30 * 3).fill(20 + k * 20) }, "jpeg", 90));
    names.push(n);
  }
  const note = "# Vzpomínky babičky\n\nVáclav Lhoták se narodil v Лготě roku 1890.".normalize("NFD");
  fs.writeFileSync(path.join(box, "poznámky.md".normalize("NFD")), note);
  fs.writeFileSync(path.join(box, "deník.txt"), "Den za dnem. ".repeat(3000));
  names.push("poznámky.md".normalize("NFD"), "deník.txt");
  const ids = ((await w.ok(["intake", ...names.map((n) => path.join(box, n)), "--json"])).json as { inputs: { id: string }[] }).inputs.map((i) => i.id);
  assert.equal(ids.length, 11);
  const [f1, f2, f3, , ...rest] = ids as string[];
  const md = ids[9]!;
  const txt = ids[10]!;
  fs.writeFileSync(
    path.join(dir, "body.md"),
    [
      `## File ${f1}\ntitle: Václav, 1910\nkind: photo\nlink: person P1\nwhy: Podpis na rubu.\nsure: medium\n`,
      `## File ${f2}\nwhy: Rozmazaná fotka, nic nečitelného.\nsure: low\n`,
      `## File ${f3}\nlink: person P99\nwhy: Asi někdo z rodiny.\nsure: low\n`,
      // the fourth: no block at all
      ...rest.slice(0, 5).map((id) => `## File: ${id}\nkind: photo\nwhy: Fotka.\nsure: low\n`),
      `## File ${md}\ntitle: Vzpomínky babičky\nkind: document\nlink: person P1\nwhy: Text vypráví o narození Václava v Lhotě.\nsure: high\n`,
      `## File ${txt}\ntitle: Deník\nkind: document\nwhy: Deník, opakuje se jedna věta.\nsure: low\n`,
    ].join("\n"),
  );
  fs.writeFileSync(path.join(dir, "hold"), "");
  w.env.SORT_HOLD_FOR = txt;
  const running = w.run(["material", "sort", ...ids, "--parallel", "1", "--json"], { dialog: true });
  try {
    // at work: the first reader's six files done (eleven in two even batches), the last one's reader waiting
    let s: ReturnType<typeof loadSort>;
    await until(
      "the first reader done",
      () => {
        const id = fs.existsSync(path.join(w.cwd, ".strom", "sorts")) ? fs.readdirSync(path.join(w.cwd, ".strom", "sorts")).find((f) => f.endsWith(".json")) : undefined;
        s = id ? loadSort(w.cwd, id.slice(0, -5)) : undefined;
        return s?.state === "working" && s.filesDone === 6;
      },
      { ms: 30_000, state: () => s },
    );
    const app = sortForApp(Tree.open(w.cwd, w.env), s!);
    assert.deepEqual([app.state, app.filesDone, app.proposals], ["working", 6, undefined], "the app shows 6 of 11");
    const shown = (await w.ok(["material", "show", s!.id])).out;
    assert.match(shown, /6 of 11 files done/u);
  } finally {
    fs.rmSync(path.join(dir, "hold"), { force: true });
  }
  const r = await running;
  assert.equal(r.code, 0, r.out + r.err);
  const got = r.json;
  assert.equal(got.state, "done");
  assert.equal(got.filesDone, 11);
  assert.deepEqual(
    got.proposals.map((p: { id: string }) => p.id),
    [f1, ...rest.slice(0, 5), md, txt],
  );
  assert.deepEqual(got.unproposed, [
    { id: f2, why: "nothing-said", said: "Rozmazaná fotka, nic nečitelného." },
    { id: f3, why: "dropped", said: "Asi někdo z rodiny." },
    { id: ids[3], why: "left-out" },
  ]);
  const said = (await w.ok(["material", "show", got.id])).out;
  assert.match(said, new RegExp(`${ids[3]} · no proposal: left-out`, "u"));
  // what the readers were told: the texts read as text, the long one's beginning said so; never "judge it by its name"
  const told = fs.readFileSync(path.join(dir, "told.txt"), "utf8");
  const mdLine = new RegExp(`- ${md} · "poznámky\\.md"[^\\n]*\\n(?:  [^\\n]*\\n)*?  read as text: ([^\\n]+)`, "u").exec(told.normalize("NFC"));
  assert.ok(mdLine, told.slice(0, 3000));
  assert.match(told, new RegExp(`- ${txt} · "deník\\.txt"[^\\n]*\\n(?:  [^\\n]*\\n)*?  read as text \\(only its first ${SORT_TEXT_FILE_MAX} characters: the file is 39 KB\\): `, "u"));
  assert.ok(!/not opened \(no picture\)/u.test(told), "no text judged by its name");
  assert.match(told, /judge a text by what it says/u);
  const copy = fs.readFileSync(mdLine![1]!, "utf8");
  assert.equal(copy, note.normalize("NFC"), "the copy its reader reads: the text in NFC");
  assert.match(fs.readFileSync(path.join(path.dirname(mdLine![1]!), `${txt}.txt`), "utf8"), /\[strom: only the first 20000 characters of this file are given here\]\n$/u);
  // the readers' own folders cleared as they ended: the desk alone stays
  assert.deepEqual(fs.readdirSync(path.join(w.home, "shared", "cache", "readers")), ["desk"]);
});
