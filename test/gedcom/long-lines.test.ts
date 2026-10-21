// A value longer than a GEDCOM line (255 bytes) goes on in CONC lines whatever its tag — a place, a name, a label —
// cut only between whole characters (never half a UTF-16 pair, an accent or an emoji's parts), never inside an escaped
// "@@", never beside a space; it reads back exactly, in strom and in the Strom app.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { GedWriter, clipChars, splitParagraph } from "../../src/gedcom/lines.ts";
import { parseGedcomText } from "../../src/gedcom/parse.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };
const graphemes = new Intl.Segmenter("und", { granularity: "grapheme" });
const LONE_HALF = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

// emoji with a skin tone, a variation selector, joined by ZWJ, a flag, a letter with a mark of no precomposed form,
// an escaped "@", Cyrillic — each beside a space or not
const MIX = "🔴 a🟢 👍🏽 ❤️ 👨‍👩‍👧 🇨🇿 q̇ @@ @@@@x Ж 🙏";

test("lines: a cut falls between whole characters, never in an escaped @@, never beside a space — wherever the emoji stand", () => {
  for (let n = 0; n <= 80; n++) {
    const text = `${"Lhota ".repeat(n)}${MIX} ${"Ves ".repeat(30)}${MIX}`.trim();
    const bounds = new Set([...graphemes.segment(text)].map((g) => g.index));
    for (const bytes of [40, 100, 248]) {
      const chunks = splitParagraph(text, bytes);
      assert.equal(chunks.join(""), text);
      let at = 0;
      for (const [i, c] of chunks.entries()) {
        assert.ok(Buffer.byteLength(c) <= bytes, `${n}/${bytes}: ${c}`);
        assert.ok(!LONE_HALF.test(c), `${n}/${bytes}: half a pair in "${c}"`);
        if (i > 0) {
          assert.ok(bounds.has(at), `${n}/${bytes}: cut inside a character before "${c}"`);
          // (40 bytes may hold only single emoji between spaces: then nothing better is possible)
          if (bytes > 40) assert.ok(!c.startsWith(" ") && !chunks[i - 1]!.endsWith(" "), `${n}/${bytes}: a space at the cut before "${c}"`);
        }
        at += c.length;
      }
      // each line unescaped alone, as readers do, gives the text
      assert.equal(chunks.map((c) => c.replace(/@@/g, "@")).join(""), text.replace(/@@/g, "@"), `${n}/${bytes}`);
    }
  }
  // nothing better than beside a space: the cut still between characters
  assert.ok(splitParagraph("🔴 ".repeat(40), 30).every((c) => !LONE_HALF.test(c) && Buffer.byteLength(c) <= 30));
  // one character longer than a line: by code points, nothing lost
  const heavy = `a${"́".repeat(200)}`;
  assert.equal(splitParagraph(heavy, 40).join(""), heavy);
  assert.deepEqual(splitParagraph("", 10), [""]);
  assert.equal(clipChars("ab👨‍👩‍👧cd", 3), "ab👨‍👩‍👧");
  assert.equal(clipChars("ab", 5), "ab");
});

test("lines: any tag's long value goes on in CONC lines and reads back whole (decomposed input written composed)", () => {
  const place = `${"Horní Lhota u Kostela, ".repeat(14)}${MIX}`.trim();
  const w = new GedWriter();
  w.line(0, "HEAD");
  w.line(1, "CHAR", "UTF-8");
  w.record("@I1@", "INDI");
  w.line(1, "BIRT");
  w.line(2, "PLAC", place.normalize("NFD"));
  w.line(2, "CAUS", place);
  w.text(1, "NOTE", `${place}\n${place}`);
  w.line(0, "TRLR");
  for (const l of w.lines) assert.ok(Buffer.byteLength(l) <= 255, l);
  assert.ok(w.lines.some((l) => l.startsWith("3 CONC ")));
  const [, indi] = parseGedcomText(w.toString()).records;
  const birt = indi!.children.find((c) => c.tag === "BIRT")!;
  assert.equal(birt.children.find((c) => c.tag === "PLAC")!.value, place.normalize("NFC"));
  assert.equal(birt.children.find((c) => c.tag === "CAUS")!.value, place);
  assert.equal(indi!.children.find((c) => c.tag === "NOTE")!.value, `${place}\n${place}`);
  const findings = validateGedcom(w.toString());
  assert.deepEqual(findings.filter((f) => /CONC under PLAC|bytes/.test(f.message)), [], "the Strom profile: a long place is no warning");
  assert.ok(validateGedcom(w.toString(), { strict: true }).some((f) => f.level === "warn" && /CONC under PLAC/.test(f.message)), "GEDCOM 5.5.1 gives PLAC no CONC: said in the standard file");
});

/** A place longer than a line, of letters, emoji, an "@" and another script. */
const LONG_PLACE = `${"Horní Lhota ".repeat(30)}🔴 u kostela 👨‍👩‍👧 Жовква @ konec`;

async function longTree(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Druhá", "--new-person", "Eva /Testová/", "--born", "1 JAN 1850", "--born-place", LONG_PLACE.normalize("NFD")]);
  await w.ok(["event", "add", "P1", "DEAT", "--date", "1901", "--place", LONG_PLACE, "--cause", `${"souchotiny a horečka ".repeat(15)}🙏`]);
  return w;
}

test("export: a place longer than a line is written (both files), each line within 255 bytes, read back exactly", opts, async () => {
  const w = await longTree();
  const r = (await w.ok(["export", "gedcom", "--for", "both", "--json"])).json;
  for (const f of r.files as { for: string; file: string; findings: { level: string; message: string }[] }[]) {
    const text = fs.readFileSync(f.file, "utf8");
    for (const l of text.split("\n")) assert.ok(Buffer.byteLength(l) <= 255, `${f.for}: ${l}`);
    assert.ok(!text.includes("�") && !LONE_HALF.test(text), f.for);
    assert.ok(!f.findings.some((x) => x.level === "error"), JSON.stringify(f.findings));
    if (f.for === "strom") assert.deepEqual(f.findings, []);
    const indi = parseGedcomText(text).records.find((n) => n.tag === "INDI")!;
    for (const tag of ["BIRT", "DEAT"]) assert.equal(indi.children.find((c) => c.tag === tag)!.children.find((c) => c.tag === "PLAC")!.value, LONG_PLACE, `${f.for} ${tag}`);
  }
  w.cleanup();
});

// The Strom app's own parser and exporter (../strom: released, ../strom-beta: coming): the long place in its person,
// and the file it gives back brings nothing to the research.
for (const dir of ["strom", "strom-beta"]) {
  const repo = path.resolve(import.meta.dirname, "..", "..", "..", dir);
  const tsx = path.join(repo, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
  test(`the Strom app (${dir}) reads a long place whole, and its file back brings nothing`, { skip: !hasGit || !fs.existsSync(tsx) }, async () => {
    const w = await longTree();
    const given = path.join(w.dir, "given.ged");
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", given]);
    const text = fs.readFileSync(given, "utf8");
    const [tree, head] = [/^1 _STROM_TREE (.+)$/m.exec(text)![1]!, /^1 _STROM_HEAD (.+)$/m.exec(text)![1]!];
    const script = path.join(w.dir, "app.ts");
    fs.writeFileSync(
      script,
      `import fs from "node:fs";
import { parseGedcom, convertToStrom } from ${JSON.stringify(path.join(repo, "src", "ged-parser.ts"))};
import { exportToGedcom } from ${JSON.stringify(path.join(repo, "src", "ged-exporter.ts"))};
const data = convertToStrom(parseGedcom(fs.readFileSync(process.argv[2]!, "utf8"))).data;
const p = (Object.values(data.persons) as any[]).find((x) => x.refn === "P0001");
fs.writeFileSync(process.argv[3]!, exportToGedcom(data, "Testovi", { research: { id: ${JSON.stringify(tree)}, head: ${JSON.stringify(head)} } }).content);
console.log(JSON.stringify({ birthPlace: p.birthPlace, deathPlace: p.deathPlace }));
`,
    );
    const back = path.join(w.dir, "back.ged");
    const r = spawnSync(tsx, [script, given, back], { cwd: repo, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    const read = JSON.parse(r.stdout.trim().split("\n").pop()!) as Record<string, string>;
    assert.deepEqual(read, { birthPlace: LONG_PLACE, deathPlace: LONG_PLACE });
    assert.deepEqual((await w.ok(["sync", back, "--json"])).json.changes, [], "unedited: nothing");
    w.cleanup();
  });
}
